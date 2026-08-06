// 인증 credential vault (0157) — SecretStore 위의 네임스페이스 강제 뷰.
//
// 구 `infra/config/secret-facade.ts` 의 prefix 강제 패턴을 이어받되 두 가지를 더한다:
//   1. **kind metadata 보존** — api_key / auth_token / PAT 를 같은 opaque 문자열로 뭉개지 않고
//      종류·서비스·scope·만료를 함께 저장한다(goose ConfigKey 선례). 요청에 넣는 방식은
//      여기서 추론하지 않는다 — connector 의 CredentialPresentation 이 선언한다.
//   2. **복호화 실패와 부재의 구분** — safeStorage 는 쓰기가 fail-closed(throw), 읽기는 null
//      강등이라 비대칭이다(infra/config/crypto.ts). 그 강등 자체는 유지하되(키체인 잠김 하나로
//      앱이 죽지 않도록) `read()` 가 어느 쪽인지 알려줘 호출부가 binding status 를 'unknown'
//      으로 둘 수 있게 한다. 조용한 미인증 진행을 막는 것이 목적이다.
//
// 레이어: infra → infra·shared 만. contracts 를 import 하지 않는다(구조적으로 만족).

import type { CredentialMeta } from '../../../shared/ipc'
import type { SecretStorePort } from '../config/secret-facade'

// metadata 는 비밀이 아니라 평문 JSON 으로 둔다 — 같은 SecretStore 를 쓰되 별도 키 접미사.
const META_SUFFIX = '#meta'

export type CredentialRead =
  | { state: 'found'; value: string }
  | { state: 'absent' }
  // 저장돼 있으나 복호화 실패(키체인 잠김·다른 사용자·다른 머신). 부재와 구분해야 한다.
  | { state: 'undecryptable' }

export interface CredentialVault {
  get(name: string): string | null
  read(name: string): CredentialRead
  set(name: string, value: string, meta: CredentialMeta): void
  delete(name: string): void
  describe(name: string): CredentialMeta | null
  // 이 네임스페이스에 속한 이름 전부 제거 (logout cleanup).
  clearAll(): void
}

// SecretStore 에 없는 열거를 위해 네임스페이스별로 이름 목록을 관리한다.
const INDEX_SUFFIX = '#index'

export function createCredentialVault(store: SecretStorePort, prefix: string): CredentialVault {
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
      store.set(key(name), value)
      store.set(metaKey(name), JSON.stringify(meta))
      writeIndex([...readIndex(), name])
    },
    delete(name) {
      store.delete(key(name))
      store.delete(metaKey(name))
      writeIndex(readIndex().filter((n) => n !== name))
    },
    describe(name) {
      const raw = store.get(metaKey(name))
      if (raw === undefined) return null
      try {
        return JSON.parse(raw) as CredentialMeta
      } catch {
        return null
      }
    },
    clearAll() {
      for (const name of readIndex()) {
        store.delete(key(name))
        store.delete(metaKey(name))
      }
      store.delete(indexKey)
    }
  }
}

// 인증 방식별 네임스페이스. 다른 방식의 비밀에 닿을 수 없게 플랫폼이 강제한다. 방식 id 는
// 등록에서 중복이 거부되므로 이 한 값으로 유일하다 — 0178 이전에는 패키지 id 가 앞에 더 붙었다.
export function authMethodPrefix(methodId: string): string {
  return `auth:${methodId}:`
}

// 레코드별 네임스페이스 — 레코드 삭제 시 clearAll() 로 잔여물을 남기지 않는다.
export function authBindingPrefix(bindingId: string): string {
  return `authbinding:${bindingId}:`
}
