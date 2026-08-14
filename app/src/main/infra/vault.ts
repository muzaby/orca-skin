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
// 확인은 끝났지만 아직 정식 키로 옮기지 않은 후보. **전이 상태이며 정식 키 형식이 아니다** —
// 0188 이 동결한 vault key 계약은 정식 키에 대한 것이고, 이 접미사는 로그인 turn 안에서만
// 존재하다 promote 와 함께 사라진다. 중간에 앱이 죽으면 다음 부팅의 `promoteStaged()` 가 마저 옮긴다.
const STAGED_SUFFIX = '#staged'
const STAGED_INDEX_SUFFIX = '#staged-index'

// **한 번 정하면 유지한다** — 사용자 디스크에 남고 다음 버전이 읽는다. 구 형식
// (`authBinding:<bindingId>:secret`)은 읽지 않는다(0180 에서 재로그인 요구로 결정 완료).
export const VAULT_PREFIX = 'provider:'

// vault 키 = `provider:<providerId>:<authKind>`. providerId 는 등록에서 중복이 거부되므로
// 이 한 쌍으로 유일하다.
export function providerVaultKey(providerId: string, authKind: ProviderAuthKind): string {
  return `${providerId}:${authKind}`
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
  // ── 2단 쓰기 (r7) ───────────────────────────────────────────────────────────
  //
  // 여러 키를 한 번에 갈아야 하는 경우(access+refresh)와 단계 실패가 섞인 상태를 남기는 것을
  // 막는다. `stage` 로 전부 쓴 뒤 `promoteStaged` 로 옮긴다 — 암호화가 실패할 수 있는 단계는
  // staging 이고, 거기서 실패하면 `discardStaged()` 로 흔적 없이 되돌아간다(정식 키 무변경).
  stage(name: string, value: string, meta: CredentialMeta): void
  // staged 를 정식 키로 옮기고 staged 를 지운다. 옮긴 이름을 돌려준다.
  promoteStaged(): string[]
  discardStaged(): void
}

export function createVault(store: SecretStorePort, prefix: string = VAULT_PREFIX): Vault {
  const key = (name: string): string => `${prefix}${name}`
  const metaKey = (name: string): string => `${prefix}${name}${META_SUFFIX}`
  const indexKey = `${prefix}${INDEX_SUFFIX}`
  const stagedKey = (name: string): string => `${prefix}${name}${STAGED_SUFFIX}`
  const stagedMetaKey = (name: string): string => `${prefix}${name}${STAGED_SUFFIX}${META_SUFFIX}`
  const stagedIndexKey = `${prefix}${STAGED_INDEX_SUFFIX}`

  const readStagedIndex = (): string[] => {
    const raw = store.get(stagedIndexKey)
    if (raw === undefined) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : []
    } catch {
      return []
    }
  }

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
      // **값 키를 마지막 secret 쓰기로 둔다** (r6). 세 단계 중 어디서 실패하든 *값*은 이전 것이
      // 남아야 한다 — 값이 새 것으로 바뀐 뒤 메타에서 실패하면, grant 는 옛 값을 가리키는데 그
      // 키에는 검증되지 않은 새 값이 들어 있는 상태가 된다. 메타를 먼저 쓰면 그 창이 닫힌다
      // (메타는 서술 정보이고 만료의 정본은 `Grant.expiresAt` 이다).
      store.set(metaKey(name), JSON.stringify(meta))
      store.set(key(name), value)
      writeIndex([...readIndex(), name])
    },
    delete(name) {
      store.delete(key(name))
      store.delete(metaKey(name))
      writeIndex(readIndex().filter((n) => n !== name))
    },
    stage(name, value, meta) {
      store.set(stagedMetaKey(name), JSON.stringify(meta))
      store.set(stagedKey(name), value)
      store.set(stagedIndexKey, JSON.stringify([...new Set([...readStagedIndex(), name])]))
    },
    promoteStaged() {
      const names = readStagedIndex()
      if (names.length === 0) return []
      // 정식 키로 옮긴다. safeStorage 가 불가한 상황이면 **첫 쓰기에서** 실패하므로 정식 키는
      // 손대기 전 상태로 남는다. 중간에 죽더라도 staged 가 남아 다음 부팅이 마저 옮긴다.
      for (const name of names) {
        const value = store.get(stagedKey(name))
        const meta = store.get(stagedMetaKey(name))
        if (value === undefined || meta === undefined) continue
        store.set(metaKey(name), meta)
        store.set(key(name), value)
      }
      writeIndex([...readIndex(), ...names])
      for (const name of names) {
        store.delete(stagedKey(name))
        store.delete(stagedMetaKey(name))
      }
      store.delete(stagedIndexKey)
      return names
    },
    discardStaged() {
      for (const name of readStagedIndex()) {
        store.delete(stagedKey(name))
        store.delete(stagedMetaKey(name))
      }
      store.delete(stagedIndexKey)
    }
  }
}
