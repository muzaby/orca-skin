// Provider 자격증명 vault (0181 — 0180 이 지운 `infra/auth/credential-vault.ts` 복원).
//
// `SecretStore`(safeStorage) 위의 **네임스페이스 강제 뷰**다. 두 가지를 더한다:
//   1. **kind metadata 보존** — api-key / pat / token 을 같은 opaque 문자열로 뭉개지 않고
//      종류·발급 시각을 함께 저장한다. 요청에 싣는 방식은 여기서 추론하지 않는다 —
//      `AuthSpec.present` 가 선언한다.
//   2. **복호화 실패와 부재의 구분** — safeStorage 는 쓰기가 fail-closed(throw), 읽기는 null
//      강등이라 비대칭이다(`infra/config/crypto.ts`). 그 강등 자체는 유지하되(키체인 잠김 하나로
//      앱이 죽지 않도록) `read()` 가 어느 쪽인지 알려줘 호출부가 grant 상태를 'unknown' 으로
//      둘 수 있게 한다. **조용한 미인증 진행을 막는 것**이 목적이다.
//
// 레이어: infra → infra·shared 만. contracts 를 import 하지 않는다.

import type { ProviderAuthKind } from '../../shared/ipc'
import type { SecretStorePort } from './config/secret-store-port'

// metadata 는 비밀이 아니라 평문 JSON 으로 둔다 — 같은 SecretStore 를 쓰되 별도 키 접미사.
const META_SUFFIX = '#meta'
// SecretStore 에 열거가 없어 네임스페이스별 이름 목록을 따로 관리한다.
const INDEX_SUFFIX = '#index'

// **한 번 정하면 유지한다** — 사용자 디스크에 남고 다음 버전이 읽는다. 구 형식
// (`authBinding:<bindingId>:secret`)은 읽지 않는다(0180 에서 재로그인 요구로 결정 완료).
export const VAULT_PREFIX = 'provider:'

// vault 키 base = `provider:<providerId>:<authKind>`. providerId 는 등록에서 중복이 거부되므로
// 이 한 쌍으로 유일하다.
//
// **이 함수가 만드는 것은 base 이지 최종 키가 아니다** (r8). 새로 쓰는 자격증명은
// `versionedVaultKey()` 로 세대를 붙여 **매번 새 키**에 앉는다 — 아래 근거 참조.
export function providerVaultKey(providerId: string, authKind: ProviderAuthKind): string {
  return `${providerId}:${authKind}`
}

// ── 세대 키 (r8) ─────────────────────────────────────────────────────────────
//
// 자격증명 교체는 **고정 키를 덮어쓰지 않는다.** 덮어쓰면 "vault 에는 새 값, 영속된 grant 는
// 옛 값" 이라는 중간 상태가 반드시 생긴다 — 두 저장소를 원자적으로 함께 쓸 방법이 없기
// 때문이다(r7 의 2단 쓰기도 promote 와 grant 저장 사이에 같은 창이 남았다).
//
// 대신 **새 값은 항상 새 키에 쓰고, grant 를 저장하는 것으로 포인터를 옮긴다.** 실패·크래시가
// 어디서 나든 결과는 둘 중 하나뿐이다:
//   · grant 저장 전 → 옛 grant 가 옛 키를 계속 가리킨다. 새 키는 아무도 안 보는 고아.
//   · grant 저장 후 → 새 grant 가 새 키를 가리킨다. 옛 키는 고아.
// 고아는 다음 부팅의 sweep(`AuthStore.restore`)이 치운다. **부분 적용된 자격증명이 없다.**
//
// 기존 설치와 호환된다 — `Grant.vaultKey` 가 포인터이므로 세대 없는 옛 키를 가리키는 grant 도
// 그대로 읽힌다. 재인증하면 그때 세대 키로 옮겨간다.
const VERSION_SEPARATOR = '@'

export function versionedVaultKey(base: string, version: string): string {
  return `${base}${VERSION_SEPARATOR}${version}`
}

// refresh token 은 access token 과 **다른 키**에 앉는다 — 하나를 지울 때 다른 하나가 남지
// 않도록 grant 가 두 키를 모두 들고 있는다.
export function providerRefreshKey(providerId: string, authKind: ProviderAuthKind): string {
  return `${providerId}:${authKind}#refresh`
}

export interface CredentialMeta {
  kind: ProviderAuthKind
  createdAt: number
  expiresAt?: number
}

export type CredentialRead =
  | { state: 'found'; value: string }
  | { state: 'absent' }
  // 저장돼 있으나 복호화 실패(키체인 잠김·다른 사용자·다른 머신). 부재와 구분해야 한다.
  | { state: 'undecryptable' }

export interface Vault {
  get(name: string): string | null
  read(name: string): CredentialRead
  set(name: string, value: string, meta: CredentialMeta): void
  delete(name: string): void
  // 이 vault 가 들고 있는 이름 전부. 어떤 grant 도 가리키지 않는 고아를 부팅에서 치우기 위해
  // 필요하다(r8) — SecretStore 에 열거가 없어 index 를 대신 읽는다.
  names(): string[]
}

export function createVault(store: SecretStorePort, prefix: string = VAULT_PREFIX): Vault {
  const key = (name: string): string => `${prefix}${name}`
  const metaKey = (name: string): string => `${prefix}${name}${META_SUFFIX}`
  const indexKey = `${prefix}${INDEX_SUFFIX}`
  const readIndex = (): string[] => {
    const raw = store.get(indexKey)
    if (raw === undefined) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : []
    } catch {
      return []
    }
  }
  const writeIndex = (names: readonly string[]): void => {
    store.set(indexKey, JSON.stringify([...new Set(names)]))
  }

  return {
    read(name) {
      const raw = store.get(key(name))
      if (raw !== undefined) return { state: 'found', value: raw }
      // SecretStore.get 은 미존재와 복호화 실패를 모두 undefined 로 반환한다. index 에 이름이
      // 남아 있는데 값이 안 나오면 복호화 실패로 판정한다.
      return readIndex().includes(name) ? { state: 'undecryptable' } : { state: 'absent' }
    },
    get(name) {
      return store.get(key(name)) ?? null
    },
    set(name, value, meta) {
      // 쓰기는 fail-closed — safeStorage 불가 시 crypto.encrypt 가 throw 한다(강등 저장 금지).
      //
      // **index 를 마지막에 쓴다.** 앞 두 쓰기 중 하나가 실패하면 이름이 index 에 없어
      // `read()` 가 `absent` 로 답한다 — 반쯤 쓰인 자리가 `undecryptable` 로 보이지 않는다.
      // 자격증명 교체가 이 키를 덮어쓰는 일은 없다(위 `versionedVaultKey` 근거).
      store.set(metaKey(name), JSON.stringify(meta))
      store.set(key(name), value)
      writeIndex([...readIndex(), name])
    },
    delete(name) {
      store.delete(key(name))
      store.delete(metaKey(name))
      writeIndex(readIndex().filter((n) => n !== name))
    },
    names() {
      return readIndex()
    }
  }
}
