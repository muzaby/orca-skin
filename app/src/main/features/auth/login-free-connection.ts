// 로그인 프리 호스트 연결 상태기계 (0291).
//
// 연결 선언(`LoginFreeDefinition.connect`)이 있는 대상만 상태를 갖는다. 상태·결과는 **프로세스
// 메모리에만** 있다(D-008) — 저장 포트를 받지 않으며 재시작하면 부팅이 `connectAll` 로 다시 확인한다.
//
//   idle ──connect──▶ checking ──run 반환──▶ connected
//                        └──────throw·timeout──▶ failed
//
// 재연결 결과가 이전과 같으면(canonical JSON) revision 을 올리지 않는다 — 실행 cache·세션을 다시
// 만들지 않기 위함이다(D-011). 확인 중에도 이전 연결의 유효성은 유지한다(카드가 깜빡이지 않는다).
//
// 순수 모듈이다 — electron·fs 를 import 하지 않는다.
import type {
  AuthChange,
  AuthId,
  AuthSnapshot,
  AuthSnapshotChangeCause,
  LoginFreeConnectionState,
  LoginFreeConnectionStatus,
  LoginFreeDefinition
} from '../../contracts/auth'
import type { HostHarnessPort } from '../../adapters/common/harness-config'
import { canonicalJson } from '../../../shared/obj'

// 연결 로직 전체 상한. 배포 로직이 signal 을 무시해도 checking 에 갇히지 않는다.
export const LOGIN_FREE_CONNECT_TIMEOUT_MS = 120_000
const MESSAGE_LIMIT = 500
export const CONNECT_FAILED_MESSAGE = '연결을 확인하지 못했습니다.'
export const CONNECT_TIMEOUT_MESSAGE = '연결 확인 시간이 초과되었습니다.'
export const CONNECT_HOST_MISSING_MESSAGE = '호스트 확인 능력이 연결되지 않았습니다.'

export interface LoginFreeConnections {
  has(authId: AuthId): boolean
  snapshot(authId: AuthId): AuthSnapshot
  connect(authId: AuthId): Promise<LoginFreeConnectionStatus>
  connectAll(): Promise<void>
  value(authId: AuthId): unknown
}

interface Entry {
  definition: LoginFreeDefinition
  state: LoginFreeConnectionState
  message?: string
  valid: boolean
  revision: number
  value?: unknown
  serialized?: string
  inFlight?: Promise<LoginFreeConnectionStatus>
}

class ConnectTimeout extends Error {}

export function createLoginFreeConnections(deps: {
  definitions: readonly LoginFreeDefinition[]
  host?: HostHarnessPort
  notify(change: AuthChange): void
  timeoutMs?: number
  logger?: (event: string, data: Record<string, unknown>) => void
}): LoginFreeConnections {
  const timeoutMs = deps.timeoutMs ?? LOGIN_FREE_CONNECT_TIMEOUT_MS
  const entries = new Map<AuthId, Entry>()
  for (const definition of deps.definitions) {
    if (definition.connect) {
      entries.set(definition.id, { definition, state: 'idle', valid: false, revision: 0 })
    }
  }

  const entryOf = (authId: AuthId): Entry => {
    const entry = entries.get(authId)
    if (!entry) throw new Error(`login-free connect is not declared: ${authId}`)
    return entry
  }

  const statusOf = (entry: Entry): LoginFreeConnectionStatus => ({
    state: entry.state,
    ...(entry.message !== undefined ? { message: entry.message } : {})
  })

  const snapshotOf = (entry: Entry): AuthSnapshot => ({
    authId: entry.definition.id,
    status: entry.valid ? 'valid' : 'none',
    verified: entry.valid,
    credentialRevision: entry.revision,
    connection: statusOf(entry)
  })

  const publish = (
    entry: Entry,
    cause: AuthSnapshotChangeCause,
    credentialChanged: boolean
  ): void => {
    deps.notify({
      kind: 'snapshot',
      authId: entry.definition.id,
      cause,
      snapshot: snapshotOf(entry),
      credentialChanged
    })
  }

  const run = async (entry: Entry): Promise<unknown> => {
    const connect = entry.definition.connect!
    if (!deps.host) throw new Error(CONNECT_HOST_MISSING_MESSAGE)
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort(new ConnectTimeout(CONNECT_TIMEOUT_MESSAGE))
        reject(new ConnectTimeout(CONNECT_TIMEOUT_MESSAGE))
      }, timeoutMs)
    })
    try {
      return await Promise.race([
        connect.run({ signal: controller.signal, host: deps.host }),
        timeout
      ])
    } finally {
      clearTimeout(timer)
    }
  }

  const failureMessage = (error: unknown): string => {
    if (error instanceof ConnectTimeout) return CONNECT_TIMEOUT_MESSAGE
    const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
    const trimmed = raw.trim()
    return trimmed === '' ? CONNECT_FAILED_MESSAGE : trimmed.slice(0, MESSAGE_LIMIT)
  }

  const connect = (authId: AuthId): Promise<LoginFreeConnectionStatus> => {
    const entry = entryOf(authId)
    if (entry.inFlight) return entry.inFlight
    entry.state = 'checking'
    delete entry.message
    publish(entry, 'connection-started', false)
    const flight = (async (): Promise<LoginFreeConnectionStatus> => {
      try {
        const raw = await run(entry)
        const value = raw === undefined ? null : raw
        const serialized = canonicalJson(value)
        entry.state = 'connected'
        if (entry.valid && entry.serialized === serialized) {
          publish(entry, 'verified', false)
        } else {
          entry.revision += 1
          entry.valid = true
          entry.value = value
          entry.serialized = serialized
          publish(entry, 'connection-succeeded', true)
        }
      } catch (error) {
        const wasValid = entry.valid
        if (wasValid) entry.revision += 1
        entry.valid = false
        delete entry.value
        delete entry.serialized
        entry.state = 'failed'
        entry.message = failureMessage(error)
        deps.logger?.('auth.login-free.connect-failed', { authId, reason: entry.message })
        publish(entry, 'connection-failed', wasValid)
      } finally {
        delete entry.inFlight
      }
      return statusOf(entry)
    })()
    entry.inFlight = flight
    return flight
  }

  return {
    has: (authId) => entries.has(authId),
    snapshot: (authId) => snapshotOf(entryOf(authId)),
    connect,
    async connectAll() {
      await Promise.allSettled([...entries.keys()].map((authId) => connect(authId)))
    },
    value(authId) {
      const entry = entries.get(authId)
      return entry?.state === 'connected' && entry.valid ? entry.value : undefined
    }
  }
}
