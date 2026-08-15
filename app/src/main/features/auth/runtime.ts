// AuthRuntime 조립 (0188) — registry · store · 인증된 요청 · 로그인 실행기를 하나로 묶어
// **소비자가 보는 유일한 인증 표면**을 만든다.
//
// ── 구 `ProviderPlatform` 과 무엇이 다른가 ────────────────────────────────────
// 0181 의 facade 는 인증 lifecycle 과 **GUI 카탈로그 DTO 조립·gate 판정**을 함께 들고 있었다.
// 여기에는 인증만 있다:
//
//   없음 — `list()`/`state()`(카탈로그 DTO)  → `app/connection-views.ts`
//   없음 — `evaluateGate(...)`               → `features/gate`
//   없음 — `declarations(kind)`              → `app/deployment/*`
//   없음 — `materialize()`                   → 소비 feature 가 자기 형상을 만든다
//
// 남은 것은 `bind`·`describe`·lifecycle·`subscribe` 다. Auth 는 자신이 gate 에 쓰이는지,
// Harness 에 쓰이는지 모른다.
//
// ── change 를 두 갈래로 내보내는 이유 ─────────────────────────────────────────
// `AuthChange` 의 `credentialChanged` 는 **소비자가 무효화 여부를 판단하는 유일한 근거**다.
// 여기서 `cause` → boolean 매핑을 한 곳에 고정한다 — 소비자마다 다시 판정하면 규칙이 갈린다.

import type {
  AuthChange,
  AuthDefinition,
  AuthDescriptor,
  AuthId,
  AuthMethod,
  AuthMethodDescriptor,
  AuthMethodKind,
  AuthRuntime,
  AuthSecretReader,
  AuthSnapshot,
  AuthSnapshotChangeCause,
  AuthStep,
  BoundAuth
} from '../../contracts/auth'
import { AuthenticatedRequester } from './authenticated-request'
import type { AuthenticatedRequesterDeps } from './authenticated-request'
import { LoginService } from './login'
import type { OAuthAuthenticator, SessionAuthenticator } from './login'
import { AuthRegistry } from './registry'
import type { AuthRejection } from './registry'
import { AuthStore } from './store'
import type { GrantPersistencePort } from './store'
import { createAuthSecretReader } from './secret-access'
import type { Vault } from '../../infra/vault'
import type { BrowserSessionPort } from './specs/browser-session'
import { registerDeclaredSessions } from './session-policies'

// **실행 credential 이 바뀐 원인만 true 다.** `verified` 는 "기록이 살아 있음을 확인했다" 는
// 뜻이지 값이 달라졌다는 뜻이 아니다 — 이것을 true 로 두면 부팅 probe 한 번에 모든 Harness
// cache 가 비고 Plugin 도구 revision 이 올라 첫 턴이 불필요하게 respawn 한다.
function isCredentialEffective(cause: AuthSnapshotChangeCause): boolean {
  return cause !== 'verified'
}

// 입력 수집형만 `fields` 를 갖는다. oauth·browser-session 은 브라우저가 값을 받으므로 빈 배열.
function methodDescriptor(method: AuthMethod): AuthMethodDescriptor {
  const fields =
    method.kind === 'oauth' || method.kind === 'browser-session'
      ? []
      : method.fields.map((field) => ({ ...field }))
  return { kind: method.kind, label: method.label, fields }
}

export interface CreateAuthRuntimeDeps {
  definitions: readonly AuthDefinition[]
  persistence: GrantPersistencePort
  vault: Vault
  // 원격 요청은 Chromium 스택으로만 나간다 (0173) — 기본값을 두지 않는다.
  fetchImpl: typeof fetch
  sessions?: BrowserSessionPort
  oauth?: OAuthAuthenticator
  session?: SessionAuthenticator
  clock?: () => number
  logger?: (event: string, data: Record<string, unknown>) => void
  onOrphan?: (authId: AuthId) => void
  // grant 저장소를 끝까지 읽지 못해 vault 고아 sweep 을 건너뛴 경우의 진단(r9).
  onSweepSkipped?: () => void
}

export interface CreatedAuthRuntime {
  runtime: AuthRuntime
  // **컴포지션 루트에만 머문다** — RouterContext·renderer IPC 로 내보내지 않는다(0188 D-010).
  secretReader: AuthSecretReader
  // 등록에서 떨어진 선언. 부팅 진단이 로그로 남긴다.
  rejected: readonly AuthRejection[]
}

export function createAuthRuntime(deps: CreateAuthRuntimeDeps): CreatedAuthRuntime {
  const registry = new AuthRegistry(deps.definitions)
  const store = new AuthStore({
    persistence: deps.persistence,
    vault: deps.vault,
    ...(deps.clock ? { clock: deps.clock } : {}),
    ...(deps.onOrphan ? { onOrphan: deps.onOrphan } : {}),
    ...(deps.onSweepSkipped ? { onSweepSkipped: deps.onSweepSkipped } : {}),
    // 해제가 내구적으로 성립한 뒤의 vault 정리 실패는 위생 통지다 (r10) — 이미 있는 logger 로
    // 흘린다. 별도 포트를 컴포지션 루트까지 뚫으면 배선만 늘고 소비자는 로그 하나다.
    onVaultCleanupFailed: (authId, error) =>
      deps.logger?.('auth.revoke.vault-cleanup-failed', { authId, reason: String(error) })
  })
  store.restore(registry.list().map((definition) => definition.id))

  // **로그인 전에 등록한다** (0182). 0181 은 `SessionRunner.login` 에서만 등록해서, 재시작 후
  // 쿠키·grant 가 살아 있어도 group 이 미등록이라 `acquire()` 가 raw throw 로 죽었다 —
  // 401 강등 경로도 타지 않아 재인증 지점조차 뜨지 않았다. 거부된 선언은 `registry.list()` 에
  // 없으므로 그 cookie jar 는 만들어지지 않는다.
  if (deps.sessions) {
    registerDeclaredSessions(deps.sessions, registry.list(), deps.logger)
  }

  const listeners = new Set<(change: AuthChange) => void>()
  const publish = (change: AuthChange): void => {
    for (const listener of listeners) listener(change)
  }

  const snapshot = (authId: AuthId): AuthSnapshot => {
    // 시간 기반 만료는 **여기서 처음 관측된다** — polling 을 새로 만들지 않는다(0188 D-037).
    // 전이가 실제로 일어났으면 credential-effective change 로 알린다.
    if (store.settleExpiry(authId)) {
      publish({
        kind: 'snapshot',
        authId,
        cause: 'expired',
        snapshot: rawSnapshot(authId),
        credentialChanged: true
      })
    }
    return rawSnapshot(authId)
  }

  const rawSnapshot = (authId: AuthId): AuthSnapshot => {
    const grant = store.get(authId)
    const activeMethod = store.authKind(authId)
    return {
      authId,
      status: store.status(authId),
      verified: store.isVerified(authId),
      credentialRevision: store.credentialRevision(authId),
      ...(activeMethod !== null ? { activeMethod } : {}),
      ...(grant?.principalId !== undefined ? { principalId: grant.principalId } : {}),
      ...(grant?.expiresAt !== undefined ? { expiresAt: grant.expiresAt } : {})
    }
  }

  const requester = new AuthenticatedRequester({
    registry,
    store,
    fetchImpl: deps.fetchImpl,
    ...(deps.sessions ? { sessions: deps.sessions } : {}),
    ...(deps.logger ? { logger: deps.logger } : {}),
    // 401/403 강등은 실행 credential 을 못 쓰게 만든 것이다 — 도구 회수와 cache 무효화가
    // 걸려 있으므로 그 자리에서 즉시 낸다.
    // 강등이 **실제 전이였을 때만** credential-effective 다 (r4) — 동시 401 두 건 중 두 번째는
    // 아무것도 바꾸지 않는다. 화면은 그래도 갱신해야 하므로 통지 자체는 낸다.
    onUnauthorized: (authId, credentialChanged) =>
      emitSnapshot(authId, 'unauthorized', credentialChanged),
    // 요청 경로에서 처음 관측된 시계 만료. store 가 1회를 보장하므로 여기서 중복 판정하지 않는다.
    onExpired: (authId) => emitSnapshot(authId, 'expired')
  } satisfies AuthenticatedRequesterDeps)

  // `credentialChanged` 를 넘기지 않으면 `cause` 가 정한다. 넘기는 쪽은 **cause 로는 알 수 없는
  // 사실**(그 관측이 실제 전이를 만들었는가)을 아는 호출부뿐이다 — 강등을 두 번 관측해도
  // 실행 credential 은 한 번만 바뀐다.
  const emitSnapshot = (
    authId: AuthId,
    cause: AuthSnapshotChangeCause,
    credentialChanged?: boolean
  ): void => {
    publish({
      kind: 'snapshot',
      authId,
      cause,
      snapshot: rawSnapshot(authId),
      credentialChanged: credentialChanged ?? isCredentialEffective(cause)
    })
  }

  const login = new LoginService({
    registry,
    store,
    vault: deps.vault,
    ...(deps.clock ? { clock: deps.clock } : {}),
    ...(deps.oauth ? { oauth: deps.oauth } : {}),
    ...(deps.session ? { session: deps.session } : {}),
    // 해제 시 session grant 의 cookie jar 를 함께 비운다 (r9).
    ...(deps.sessions ? { sessions: deps.sessions } : {}),
    // 후보(`candidate`)는 확인이 끝날 때까지 store·vault 를 거치지 않는다 (r5).
    request: (authId, req, signal, candidate) => requester.request(authId, req, signal, candidate),
    onStep: (step) => publish({ kind: 'step', authId: step?.providerId ?? '', step }),
    onSnapshot: emitSnapshot,
    ...(deps.logger ? { logger: deps.logger } : {})
  })

  const bind = (authId: AuthId): BoundAuth => ({
    authId,
    snapshot: () => snapshot(authId),
    request: (req, signal) => requester.request(authId, req, signal)
  })

  const runtime: AuthRuntime = {
    bind,
    tryBind: (authId) => (registry.get(authId) ? bind(authId) : null),
    describe(authId) {
      const definition = registry.get(authId)
      if (!definition) throw new Error(`unknown auth: ${authId}`)
      const descriptor: AuthDescriptor = {
        authId: definition.id,
        label: definition.label,
        origin: definition.origin,
        methods: definition.methods.map(methodDescriptor)
      }
      return descriptor
    },
    currentStep: (): AuthStep | null => login.currentStep(),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    resume: (authId, options) => login.resume(authId, options),
    login: (authId, method?: AuthMethodKind, input?: Record<string, string>) =>
      login.begin(authId, method, input),
    continue: (authId, input) => login.continue(authId, input),
    reauth: (authId, method?: AuthMethodKind) => login.reauth(authId, method),
    revoke: (authId) => login.revoke(authId)
  }

  return { runtime, secretReader: createAuthSecretReader(store), rejected: registry.rejected() }
}
