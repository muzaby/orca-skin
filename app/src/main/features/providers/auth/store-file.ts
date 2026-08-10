// Grant 영속 어댑터 (0181 — 0180 이 지운 `infra/auth/binding-store-file.ts` 복원).
//
// **여기에는 비밀이 없다.** 값은 vault(safeStorage 암호문)에만 있고 이 파일에 남는 것은 vault
// 키·방식·만료 같은 메타뿐이다 — 이미 renderer 로 나가는 DTO 와 같은 급의 정보다.
//
// 형상 검사(`parseGrantRecords`)는 순수 함수라 단위 테스트 대상이고, electron-store 를 무는
// 팩토리만 테스트에서 제외된다. `Grant` 가 contracts 타입이라 이 어댑터는 infra 가 아니라
// feature 에 산다(infra → contracts 는 DAG 역방향).

import Store from 'electron-store'
import type { ProviderAuthKind } from '../../../../shared/ipc'
import type { Grant } from '../../../contracts/provider'
import type { GrantPersistencePort } from './store'
import type { OAuthStatePersistencePort, PendingAuthorization } from './oauth'

// 한 번 정하면 유지한다 — 사용자 디스크에 남고 다음 버전이 읽는다.
const STORE_NAME = 'orca-provider-grants'
const RECORDS_KEY = 'grants'

const AUTH_KINDS: readonly ProviderAuthKind[] = [
  'api-key',
  'password',
  'pat',
  'oauth',
  'browser-session'
]

function isAuthKind(value: unknown): value is ProviderAuthKind {
  return typeof value === 'string' && (AUTH_KINDS as readonly string[]).includes(value)
}

function parseGrant(raw: unknown): Grant | null {
  if (raw === null || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (!isAuthKind(record.authKind)) return null
  if (typeof record.createdAt !== 'number') return null
  const base = {
    authKind: record.authKind,
    createdAt: record.createdAt,
    ...(typeof record.principalId === 'string' ? { principalId: record.principalId } : {})
  }
  switch (record.kind) {
    case 'secret':
      if (typeof record.vaultKey !== 'string') return null
      return { kind: 'secret', vaultKey: record.vaultKey, ...base }
    case 'token':
      if (typeof record.vaultKey !== 'string') return null
      return {
        kind: 'token',
        vaultKey: record.vaultKey,
        ...(typeof record.expiresAt === 'number' ? { expiresAt: record.expiresAt } : {}),
        ...(typeof record.refreshKey === 'string' ? { refreshKey: record.refreshKey } : {}),
        ...base
      }
    case 'session':
      if (typeof record.sessionGroup !== 'string') return null
      return { kind: 'session', sessionGroup: record.sessionGroup, ...base }
    default:
      return null
  }
}

// 형상이 깨진 레코드는 **그 하나만** 버린다. 파일 전체를 버리면 provider 하나의 손상이 나머지
// 로그인까지 날린다.
export function parseGrantRecords(raw: unknown): Record<string, Grant> {
  if (raw === null || typeof raw !== 'object') return {}
  const out: Record<string, Grant> = {}
  for (const [providerId, value] of Object.entries(raw as Record<string, unknown>)) {
    const grant = parseGrant(value)
    if (grant) out[providerId] = grant
  }
  return out
}

// ── OAuth 인가 pending (0181 AC4) ─────────────────────────────────────────────
//
// **왜 파일인가**: 루프백 콜백은 사용자의 브라우저가 앱 밖에서 완료시킨다. 그 사이 앱이
// 재시작되면 메모리의 state·verifier 가 사라져 돌아온 콜백을 대조할 수 없다 — 대조 실패는
// 곧 로그인 실패다. grant 와 **다른 파일**에 두는 이유는 수명이 다르기 때문이다(인가 pending 은
// 분 단위, grant 는 재로그인까지).
const OAUTH_STORE_NAME = 'orca-provider-oauth'
const PENDING_KEY = 'pending'

function parsePending(raw: unknown): PendingAuthorization | null {
  if (raw === null || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (typeof record.providerId !== 'string') return null
  if (typeof record.state !== 'string') return null
  if (typeof record.verifier !== 'string') return null
  if (typeof record.createdAt !== 'number') return null
  return {
    providerId: record.providerId,
    state: record.state,
    verifier: record.verifier,
    createdAt: record.createdAt,
    ...(typeof record.redirectUri === 'string' ? { redirectUri: record.redirectUri } : {})
  }
}

export function parsePendingRecords(raw: unknown): Record<string, PendingAuthorization> {
  if (raw === null || typeof raw !== 'object') return {}
  const out: Record<string, PendingAuthorization> = {}
  for (const [state, value] of Object.entries(raw as Record<string, unknown>)) {
    const pending = parsePending(value)
    if (pending) out[state] = pending
  }
  return out
}

export function createOAuthStatePersistence(): OAuthStatePersistencePort {
  const store = new Store<Record<string, unknown>>({ name: OAUTH_STORE_NAME, defaults: {} })
  return {
    load(): Record<string, PendingAuthorization> {
      try {
        return parsePendingRecords(store.get(PENDING_KEY))
      } catch {
        return {}
      }
    },
    save(records: Record<string, PendingAuthorization>): void {
      store.set(PENDING_KEY, records)
    }
  }
}

export function createGrantPersistence(): GrantPersistencePort {
  const store = new Store<Record<string, unknown>>({ name: STORE_NAME, defaults: {} })
  return {
    load(): Record<string, Grant> {
      try {
        return parseGrantRecords(store.get(RECORDS_KEY))
      } catch {
        // 파일 자체가 JSON 이 아니면 electron-store 가 던진다. 그래도 앱은 떠야 한다.
        return {}
      }
    },
    save(records: Record<string, Grant>): void {
      store.set(RECORDS_KEY, records)
    }
  }
}
