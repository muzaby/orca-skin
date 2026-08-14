// 로그인 실행 (0181 → 0188) — `AuthMethod` 분기를 돌려 grant 를 만든다. 인증의 **유일한 입구**다.
//
// 구 구조의 transaction store·loginChain·cascade 는 없다. 상태는 **Auth 당 pending 1건**이
// 전부이고, 그 pending 이 하는 일은 "다음 `continue` 가 어느 방식으로 이어지는가" 하나다.
//
// ── 재인증 의미론 (AC6) ──────────────────────────────────────────────────────
// `reauth` 는 기존 grant 를 **먼저 지우지 않는다**. 새 인증이 성공해야 교체된다 — 실패하면
// 이전 자격증명으로 계속 쓸 수 있어야 하기 때문이다. 입력형 방식에서 "성공" 은 곧 vault 쓰기라,
// compose 가 거부하면 vault 에 손도 대지 않는다.

import type { ProviderFailureReason } from '../../../shared/ipc'
import type {
  AuthDefinition,
  AuthenticatedRequest,
  AuthenticatedResponse,
  AuthId,
  AuthMethod,
  AuthMethodKind,
  AuthSnapshotChangeCause,
  AuthStep,
  Grant,
  TokenValue
} from '../../contracts/auth'
import { errorMessage } from '../../infra/errors'
import { providerRefreshKey, providerVaultKey, type Vault } from '../../infra/vault'
import type { CandidateCredential } from './authenticated-request'
import { isAllowedOrigin } from './policy'
import type { AuthRegistry } from './registry'
import type { AuthStore } from './store'

// 방식 실행기가 돌려주는 원자재. grant 로 접는 것은 이 파일의 몫이다 — 실행기는 vault 를 모른다.
export type AuthResult =
  | { kind: 'secret'; value: string; principalId?: string }
  | { kind: 'token'; token: TokenValue }
  | { kind: 'session'; sessionGroup: string; principalId?: string }
  // OAuth `redirect:'manual'` — 사용자가 code 를 붙여 넣어야 이어진다.
  | { kind: 'code-required'; url: string }
  | { kind: 'failed'; reason: ProviderFailureReason; message: string }

export type OAuthSpec = Extract<AuthMethod, { kind: 'oauth' }>
export type BrowserSessionSpec = Extract<AuthMethod, { kind: 'browser-session' }>

// 단계 2 가 채운다. 미주입이면 oauth 선언은 `unsupported` 로 실패한다 — 조용히 성공시키지 않는다.
export interface OAuthAuthenticator {
  begin(definition: AuthDefinition, spec: OAuthSpec): Promise<AuthResult>
  complete(definition: AuthDefinition, spec: OAuthSpec, code: string): Promise<AuthResult>
}

// 단계 3 이 채운다. **창을 여는 일만** 한다 — 성립 여부 판정은 `AuthDefinition.probe` 가 맡는다.
export interface SessionAuthenticator {
  login(definition: AuthDefinition, spec: BrowserSessionSpec): Promise<AuthResult>
}

// probe 왕복 상한. 없으면 SP 가 응답하지 않을 때 로그인 invoke 가 매달려 화면이 멈춘 것처럼
// 보인다(부팅 복원에서는 게이트가 영영 안 열린다).
const PROBE_TIMEOUT_MS = 15_000

export interface LoginDeps {
  registry: AuthRegistry
  store: AuthStore
  vault: Vault
  clock?: () => number
  oauth?: OAuthAuthenticator
  session?: SessionAuthenticator
  // 인증 확인(`AuthDefinition.probe`)의 실행 통로. 미주입이면 확인 없이 통과한다.
  // `candidate` 는 **아직 커밋되지 않은** 자격증명이다 (r5) — store·vault 를 거치지 않고
  // 이 요청에만 실린다.
  request?: (
    authId: AuthId,
    req: AuthenticatedRequest,
    signal?: AbortSignal,
    candidate?: CandidateCredential
  ) => Promise<AuthenticatedResponse>
  // ── 두 갈래 통지 (0188 D-008) ───────────────────────────────────────────────
  //
  // 0181 은 `onChange()` 하나였다. 그래서 입력 폼을 연 것과 credential 을 커밋한 것이 소비자에게
  // 같은 신호로 도착했고, 소비자는 UI 변화마다 Plugin 도구를 다시 sync 하고 Harness cache 를
  // 비울 수밖에 없었다. 여기서 갈라 둔다.
  //
  //   onStep     — UI 단계 전이(입력 폼·OAuth 대기·resuming·실패 message). 화면만 바뀐다.
  //   onSnapshot — 인증 상태 전이. `cause` 가 실행 credential 이 바뀌었는지까지 말한다.
  onStep?: (step: AuthStep | null) => void
  onSnapshot?: (authId: AuthId, cause: AuthSnapshotChangeCause) => void
  // 자동 로그인 진단. probe 성공·실패가 여기로 나간다.
  logger?: (event: string, data: Record<string, unknown>) => void
}

// 확인 결과 3분기 (r7). `rejected` 와 `superseded` 를 합치면 늦게 끝난 옛 시도가 화면을 덮는다.
type SettleOutcome =
  | { kind: 'settled'; step: AuthStep }
  // 서버가 후보를 거부했다 — 호출자가 자기 실패 모양(폼 재표시 또는 `failed`)을 만든다.
  | { kind: 'rejected' }
  // 사용자가 그 사이 다른 시도를 시작했거나 해제했다 — **아무것도 하지 않는다.**
  | { kind: 'superseded' }

interface Pending {
  authId: AuthId
  authKind: AuthMethodKind
}

export class LoginService {
  private readonly pending = new Map<string, Pending>()
  // ── attempt fence (r6) ──────────────────────────────────────────────────────
  //
  // 후보 커밋은 `await probeOk()` **뒤에** 일어난다. 그 사이 같은 Auth 에 다른 일이 벌어질 수
  // 있다 — 사용자가 폼을 다시 제출하거나(`continue` 두 건), [연결 해제] 를 누르거나. r5 는
  // probe 성공만 보고 무조건 커밋해서 ① 늦게 끝난 옛 후보가 새 후보를 덮고 ② probe 중 해제한
  // Auth 가 커밋으로 되살아났다.
  //
  // 그래서 Auth 마다 **시도 세대**를 둔다. 로그인 진입과 해제가 세대를 올리고, 커밋은 자기
  // 세대가 아직 최신일 때만 일어난다.
  //
  // **`credentialRevision` 은 fence 에 넣지 않는다.** 넣으면 probe 도중 401 강등이 일어난
  // 재인증이 커밋되지 못한다 — 그 강등이야말로 재인증을 하는 이유다. 세대는 "이 로그인이
  // 아직 사용자가 원하는 그 로그인인가" 만 묻는다.
  private readonly attempts = new Map<string, number>()
  private readonly clock: () => number

  constructor(private readonly deps: LoginDeps) {
    this.clock = deps.clock ?? Date.now
  }

  // 지금 진행 중인 단계(있으면). renderer state 가 싣는다.
  currentStep(): AuthStep | null {
    return this.step
  }

  private step: AuthStep | null = null

  // 새 시도를 연다. 이전 시도의 커밋은 이 순간 무효가 된다.
  private openAttempt(authId: AuthId): number {
    const next = (this.attempts.get(authId) ?? 0) + 1
    this.attempts.set(authId, next)
    return next
  }

  private isCurrentAttempt(authId: AuthId, attempt: number): boolean {
    return this.attempts.get(authId) === attempt
  }

  async begin(
    authId: AuthId,
    authKind?: AuthMethodKind,
    input?: Record<string, string>
  ): Promise<AuthStep> {
    return this.run(authId, authKind, input)
  }

  // 재인증도 같은 경로다 — 차이는 **기존 grant 를 남겨둔 채** 시작한다는 것뿐이고, 그것이
  // `begin` 의 기본 동작이므로 별도 분기가 필요 없다. 표면을 나누는 이유는 IPC 계약(카탈로그의
  // [재인증] 버튼)이 의도를 명시하기 위함이다.
  async reauth(authId: AuthId, authKind?: AuthMethodKind): Promise<AuthStep> {
    return this.run(authId, authKind)
  }

  async continue(authId: AuthId, input: Record<string, string>): Promise<AuthStep> {
    const pending = this.pending.get(authId)
    if (!pending) {
      return this.fail(authId, 'cancelled', '진행 중인 인증이 없습니다')
    }
    return this.run(authId, pending.authKind, input)
  }

  revoke(authId: AuthId): void {
    this.pending.delete(authId)
    // 진행 중인 probe 의 커밋을 무효화한다 — 해제한 Auth 가 뒤늦은 커밋으로 되살아나면 안 된다.
    this.openAttempt(authId)
    const removed = this.deps.store.revoke(authId)
    if (this.step?.providerId === authId) {
      this.step = null
      this.deps.onStep?.(null)
    }
    // grant 가 없었으면 아무것도 바뀌지 않았다 — 빈 해제로 Plugin 도구를 다시 sync 하지 않는다.
    if (removed) this.deps.onSnapshot?.(authId, 'revoked')
  }

  // ── 복원된 Grant 의 확인 (0181 → 0188 재배치) ────────────────────────────────
  //
  // 복원된 grant 는 *기록*이지 인증이 아니다(`AuthSnapshot.verified`). 여기서 한 번 확인해야
  // 게이트가 열린다. **확인 방법은 방식과 무관하게 하나다** — `AuthDefinition.probe`.
  //
  //   session — 쿠키는 Chromium 파티션에 복원돼 있다. 물어봐야만 살아 있는지 안다.
  //   값형    — vault 에 값이 남아 있어도 서버가 그 PAT·API key 를 이미 회수했을 수 있다.
  //             (만료를 아는 것은 토큰뿐이고, 그 외에는 서버만 안다.)
  //
  // **0188 이 여기서 뺀 것: 순서 지식.** 구 `resume()` 은 `registry.byKind('gate')` 를 돌고
  // 그 뒤 `sweepPlugins()` 로 나머지를 훑었다 — 인증 코어가 "게이트가 먼저" 라는 *제품 정책*을
  // 알아야 성립하는 구조였다. 이제 이 함수는 **Auth 하나**만 확인하고, 순서·병렬성·통지 합치기는
  // app composition 이 소유한다(`app/bootstrap.ts` 의 `resumeAuthInCurrentOrder`).
  //
  // 던지지 않는다 — 부팅 경로라 실패는 전부 "수동 로그인 필요" 로 접는다.
  //
  // `exposeStep`         — `resuming` step 을 GUI 에 노출할지. 게이트는 true(로그인 화면이 진행을
  //                        보여야 한다), 나머지 batch 는 false.
  // `emitVerifiedChange` — 성공(`verified` 전이)했을 때 즉시 통지할지. batch 는 false 로 두고
  //                        호출자가 마지막에 한 번 push 한다. **실패 강등은 이 값과 무관하게
  //                        즉시 통지한다** — 죽은 연결의 도구가 남은 probe 의 타임아웃만큼
  //                        화면에 남으면 안 된다(0187 D2 의 `1 + K` 상한).
  async resume(
    authId: AuthId,
    options?: { exposeStep?: boolean; emitVerifiedChange?: boolean }
  ): Promise<void> {
    const definition = this.deps.registry.get(authId)
    if (!definition) return

    // 복원된 grant 가 **이미 시계상 만료**된 경우 (r3). `restorable()` 은 `status !== 'valid'`
    // 를 보고 조용히 건너뛰었는데, 그러면 전이가 정착되지 않아 도구·GUI 가 살아 있는 것처럼
    // 남는다. 부팅에서 이것을 못 박는 유일한 지점이 여기다.
    if (this.deps.store.settleExpiry(authId)) {
      this.deps.onSnapshot?.(authId, 'expired')
      return
    }
    if (!this.restorable(definition)) return

    const exposeStep = options?.exposeStep ?? true
    if (exposeStep) this.emit({ kind: 'resuming', providerId: definition.id })

    const ok = await this.probeOk(definition)
    // **전이를 만든 호출만 통지한다** (r4). probe 가 401/403 을 받은 경우 요청 경로가 이미
    // 강등하고 `onUnauthorized` 로 통지했다 — 여기서 다시 내면 같은 사실이 두 번 나가고,
    // 두 번째는 revision 이 그대로라 `credentialChanged:true` 와 어긋난다. 그 유령 이벤트가
    // 부팅 방송 상한을 `1 + K`(0187 D2)에서 `1 + 2K` 로 늘리고 Harness cache 를 한 번 더 비웠다.
    //
    // 401 이 아닌 실패(비-2xx·origin 미복귀·전송 오류)에서는 요청 경로가 강등하지 않으므로
    // 여기가 유일한 전이 지점이고, `markExpired` 가 전이를 보고한다.
    const demoted = ok ? null : this.deps.store.markExpired(definition.id)
    if (ok) this.deps.store.markVerified(definition.id)

    if (exposeStep) {
      this.clearResumingStep(definition.id)
      this.deps.onStep?.(this.step)
    }
    // 실패 강등은 credential-effective 다(도구 회수·cache 무효화가 걸린다) — 전이가 있었으면
    // 즉시 낸다. 성공은 `verified` 만 바뀐 것이라 batch 가 마지막에 한 번 모아 낼 수 있다.
    if (!ok) {
      if (demoted?.credentialChanged) this.deps.onSnapshot?.(definition.id, 'expired')
    } else if (options?.emitVerifiedChange ?? true) {
      this.deps.onSnapshot?.(definition.id, 'verified')
    }
  }

  // 확인 대상인가 — grant 가 있고, 아직 이번 실행에서 확인되지 않았고, 지금 요청을 낼 수 있는
  // 상태인가. `status !== 'valid'` 면 정책이 요청 자체를 막으므로 물어볼 수 없다.
  private restorable(definition: AuthDefinition): boolean {
    if (!this.deps.store.get(definition.id)) return false
    if (this.deps.store.isVerified(definition.id)) return false
    return this.deps.store.status(definition.id) === 'valid'
  }

  // `resuming` 을 걷어낸다. 결과는 게이트 상태가 말하므로 별도 step 을 남기지 않는다 —
  // 실패했으면 로그인 화면이 그대로 있고, 성공했으면 화면이 넘어간다. **통지는 하지 않는다** —
  // 호출자(`resume`)가 성공/실패에 따라 한 번만 낸다.
  private clearResumingStep(authId: AuthId): void {
    if (this.step?.kind === 'resuming' && this.step.providerId === authId) this.step = null
  }

  private async run(
    authId: AuthId,
    authKind: AuthMethodKind | undefined,
    input?: Record<string, string>
  ): Promise<AuthStep> {
    // 이 호출이 지금부터 그 Auth 의 유일한 유효 시도다 — 앞선 시도가 probe 중이면 그 커밋은
    // 버려진다.
    const attempt = this.openAttempt(authId)
    const definition = this.deps.registry.get(authId)
    if (!definition) return this.fail(authId, 'unknown_provider', '등록되지 않은 Auth 입니다')

    // 방식 미지정 = 선언 배열의 첫 방식. 단일 선언이면 GUI 가 고를 것이 없다.
    const spec = authKind
      ? definition.methods.find((candidate) => candidate.kind === authKind)
      : definition.methods[0]
    if (!spec) {
      return this.fail(authId, 'unknown_auth_kind', '선언되지 않은 인증 방식입니다')
    }

    switch (spec.kind) {
      case 'api-key':
      case 'password':
      case 'pat':
        return this.runCredential(definition, attempt, spec, input)
      case 'oauth':
        return this.runOAuth(definition, attempt, spec, input)
      case 'browser-session':
        return this.runSession(definition, attempt, spec)
    }
  }

  // ── 인증 확인 (probe) ────────────────────────────────────────────────────────
  //
  // 실행은 주입된 인증 요청 **한 줄**이다. grant 를 먼저 커밋해 두므로 세션이면 cookie jar
  // 로, 값형이면 `present` 로 실려 나가는 것을 `transport()` 가 갈라 준다 — 검증 경로와 사용
  // 경로가 글자까지 같아진다.
  //
  // **status 만 보지 않는다** (0174 실기): SSO 배포는 미인증일 때 IdP 로그인 폼을 **200** 으로
  // 준다. 체인이 definition origin 으로 돌아왔는지까지 봐야 그 200 을 인증됨으로 오독하지 않는다.
  // allowlist 밖으로 튄 홉은 `api.request` 가 던지고, 그 자체가 미인증 판정이다.
  private async probeOk(
    definition: AuthDefinition,
    candidate?: CandidateCredential
  ): Promise<boolean> {
    const probe = definition.probe
    if (!probe || !this.deps.request) return true
    try {
      const res = await this.deps.request(
        definition.id,
        { path: probe.path, ...(probe.method !== undefined ? { method: probe.method } : {}) },
        AbortSignal.timeout(PROBE_TIMEOUT_MS),
        candidate
      )
      // origin 비교는 브라우저 세션·홉별 검사와 **같은 구현**을 쓴다 — 두 벌이면 규칙이
      // 갈리는데, 하필 이 한 줄이 "인증됐는가" 의 판정이다. `definition.origin` 은 등록에서
      // bare origin 임이 강제되므로(`registry.isBareOrigin`) allowlist 원소로 그대로 쓴다.
      const returned = isAllowedOrigin(res.finalUrl, [definition.origin])
      const ok = res.ok && returned
      // 성공·실패 **양쪽 다** 남긴다 — 쿠키·키가 재시작을 넘어왔는지를 이 한 줄이 말해 준다.
      this.deps.logger?.('auth.probe.result', {
        authId: definition.id,
        ok,
        status: res.status,
        returned
      })
      return ok
    } catch (error) {
      // 네트워크 미연결(VPN 전)·정책 위반(allowlist 밖 redirect)·타임아웃. 전부 미인증이다.
      this.deps.logger?.('auth.probe.failed', {
        authId: definition.id,
        reason: errorMessage(error)
      })
      return false
    }
  }

  // 확인 → 성공하면 **한 번에 커밋**한다 (r5). `null` = 확인 실패 — 호출자가 자기 실패 모양을
  // 만든다(입력 폼이 있는 방식은 같은 폼으로, 브라우저 흐름은 `failed` 로).
  //
  // ── 왜 순서를 뒤집었나 (0188 D-009 → D-047) ──────────────────────────────────
  // r4 까지는 커밋 → 확인 → 실패면 되돌림이었다. `checkOutboundRequest` 가 `grantStatus`
  // 를 보기 때문에 커밋 없이는 probe 를 낼 수 없었다. 그 되돌림은 원리적으로 불완전했다 —
  // probe 왕복 동안 후보 secret 과 올라간 revision 이 전역에 노출됐고, 후보의 401 이 낸 강등
  // 이벤트는 상태를 되돌려도 취소되지 않아 **Plugin 도구가 회수된 채로 남았다**.
  //
  // 이제 후보를 `CandidateCredential` 로 요청에 실어 보낸다. store 도 vault 도 확인이 끝날
  // 때까지 아무것도 모르므로 **되돌릴 중간 상태가 아예 생기지 않는다**. vault 쓰기(`writeVault`)
  // 도 성공 후에만 일어나 probe 중 종료되는 crash window 가 닫힌다.
  private async settleGrant(
    definition: AuthDefinition,
    attempt: number,
    candidate: CandidateCredential,
    stageVault?: () => void
  ): Promise<SettleOutcome> {
    if (!(await this.probeOk(definition, candidate))) {
      // 아무것도 쓰지 않았다 — 이전 자격증명은 손대지 않은 채 그대로 살아 있다.
      // 통지는 호출자의 `emit`(폼 재표시 또는 `failed`)이 한다 — 두 번 쏘지 않는다.
      return { kind: 'rejected' }
    }
    // **커밋 직전에 세대를 확인한다** (r6). probe 왕복 동안 사용자가 폼을 다시 냈거나 연결을
    // 해제했으면 이 후보는 더 이상 사용자가 원하는 값이 아니다.
    //
    // 이때는 `rejected` 와 **다른 결과**를 돌려준다 (r7). 둘을 같은 `null` 로 합치면 호출부가
    // 거부 폼을 다시 열어, 이미 성공한 새 로그인의 화면을 늦게 끝난 옛 시도가 덮어쓴다 —
    // 해제 직후에도 거부 폼이 열렸다. superseded 는 **아무것도 하지 않는 것**이 정답이다.
    if (!this.isCurrentAttempt(definition.id, attempt)) {
      this.deps.logger?.('auth.login.attempt-superseded', { authId: definition.id })
      return { kind: 'superseded' }
    }
    // 확인된 값만 영속한다. **2단 쓰기**(r7): 후보를 전부 staged 로 쓴 뒤 한 번에 옮긴다 —
    // 암호화가 실패할 수 있는 단계는 staging 이고, 거기서 실패하면 정식 키는 손대기 전 그대로다.
    // access/refresh 처럼 키가 둘 이상이어도 "일부만 새 값" 상태가 생기지 않는다.
    if (stageVault) {
      try {
        stageVault()
        this.deps.vault.promoteStaged()
      } catch (error) {
        this.deps.vault.discardStaged()
        this.deps.logger?.('auth.login.vault-write-failed', {
          authId: definition.id,
          reason: errorMessage(error)
        })
        return { kind: 'rejected' }
      }
    }
    try {
      // `put` 은 영속을 먼저 하고 메모리를 나중에 바꾼다 — 저장이 실패하면 메모리도 그대로다.
      this.commit(definition.id, candidate.grant, false)
    } catch (error) {
      this.deps.logger?.('auth.login.persist-failed', {
        authId: definition.id,
        reason: errorMessage(error)
      })
      return { kind: 'rejected' }
    }
    this.deps.onSnapshot?.(definition.id, 'credential-committed')
    return { kind: 'settled', step: this.emit({ kind: 'done', providerId: definition.id }) }
  }

  private async runCredential(
    definition: AuthDefinition,
    attempt: number,
    spec: Extract<AuthMethod, { kind: 'api-key' | 'password' | 'pat' }>,
    input: Record<string, string> | undefined
  ): Promise<AuthStep> {
    // 1회차는 입력이 없으므로 필드를 알린다. **신뢰된 prompt** 다 — 방식이 만든 임의 UI 가
    // 아니라 Orca 가 이 필드 선언을 렌더링한다.
    if (!input || !spec.fields.some((field) => input[field.name] !== undefined)) {
      this.pending.set(definition.id, { authId: definition.id, authKind: spec.kind })
      return this.emit({
        kind: 'input-required',
        providerId: definition.id,
        authKind: spec.kind,
        fields: [...spec.fields]
      })
    }

    const composed = spec.compose(input)
    if ('error' in composed) {
      // 실패해도 pending 은 유지한다 — 사용자가 같은 폼에서 고쳐 다시 낸다.
      return this.emit({
        kind: 'input-required',
        providerId: definition.id,
        authKind: spec.kind,
        fields: [...spec.fields],
        message: composed.error
      })
    }

    const vaultKey = providerVaultKey(definition.id, spec.kind)
    const createdAt = this.clock()
    const settled = await this.settleGrant(
      definition,
      attempt,
      {
        grant: {
          kind: 'secret',
          vaultKey,
          authKind: spec.kind,
          createdAt,
          ...(composed.principalId !== undefined ? { principalId: composed.principalId } : {})
        },
        secret: composed.value
      },
      () => this.deps.vault.stage(vaultKey, composed.value, { kind: spec.kind, createdAt })
    )
    if (settled.kind === 'settled') return settled.step
    // superseded — 이 시도는 더 이상 사용자가 원하는 것이 아니다. pending·step·이벤트 **전부
    // 건드리지 않고** 현재 단계를 그대로 돌려준다(r7). 거부 폼을 열면 이미 성공한 새 로그인의
    // 화면을 덮는다.
    if (settled.kind === 'superseded')
      return this.step ?? { kind: 'done', providerId: definition.id }

    // 서버가 그 값을 거부했다 — pending 을 살려 **같은 폼**으로 돌려준다(compose 오류와 같은
    // 모양). 재인증이었다면 이전 자격증명은 **손도 대지 않았다**(r5 D-047).
    this.pending.set(definition.id, { authId: definition.id, authKind: spec.kind })
    return this.emit({
      kind: 'input-required',
      providerId: definition.id,
      authKind: spec.kind,
      fields: [...spec.fields],
      message: '자격증명이 거부되었습니다. 값을 확인해 주세요.'
    })
  }

  private async runOAuth(
    definition: AuthDefinition,
    attempt: number,
    spec: OAuthSpec,
    input: Record<string, string> | undefined
  ): Promise<AuthStep> {
    const authenticator = this.deps.oauth
    if (!authenticator) {
      return this.fail(definition.id, 'unsupported', 'OAuth 실행기가 배선되지 않았습니다')
    }
    // manual 분기의 2회차 — 사용자가 붙여 넣은 code 로 교환한다.
    const code = input?.code?.trim()
    const result = code
      ? await authenticator.complete(definition, spec, code)
      : await authenticator.begin(definition, spec)
    return this.absorb(definition, attempt, spec.kind, result)
  }

  private async runSession(
    definition: AuthDefinition,
    attempt: number,
    spec: BrowserSessionSpec
  ): Promise<AuthStep> {
    const authenticator = this.deps.session
    if (!authenticator) {
      return this.fail(definition.id, 'unsupported', '브라우저 세션 실행기가 배선되지 않았습니다')
    }
    return this.absorb(definition, attempt, spec.kind, await authenticator.login(definition, spec))
  }

  // 실행기 결과 → grant. vault 쓰기가 여기 한 곳에 모인다.
  //
  // 성공 분기 3종은 전부 `settleGrant` 를 지난다 — OAuth·브라우저 세션도 값형과 **같은 확인**을
  // 받는다. 창이 `doneUrlPrefix` 에 도달한 것만으로 성공을 선언하지 않는 이유가 여기 있다
  // (로그인 폼이 같은 접두사로 렌더되는 배포가 있다).
  private async absorb(
    definition: AuthDefinition,
    attempt: number,
    authKind: AuthMethodKind,
    result: AuthResult
  ): Promise<AuthStep> {
    switch (result.kind) {
      case 'code-required': {
        this.pending.set(definition.id, { authId: definition.id, authKind })
        return this.emit({
          kind: 'code-required',
          providerId: definition.id,
          authKind,
          url: result.url
        })
      }
      case 'failed':
        return this.fail(definition.id, result.reason, result.message)
      case 'secret': {
        const vaultKey = providerVaultKey(definition.id, authKind)
        const createdAt = this.clock()
        return this.settled(
          definition,
          await this.settleGrant(
            definition,
            attempt,
            {
              grant: {
                kind: 'secret',
                vaultKey,
                authKind,
                createdAt,
                ...(result.principalId !== undefined ? { principalId: result.principalId } : {})
              },
              secret: result.value
            },
            () => this.deps.vault.stage(vaultKey, result.value, { kind: authKind, createdAt })
          )
        )
      }
      case 'token': {
        const vaultKey = providerVaultKey(definition.id, authKind)
        const createdAt = this.clock()
        const { token } = result
        const refreshKey =
          token.refreshToken !== undefined ? providerRefreshKey(definition.id, authKind) : undefined
        return this.settled(
          definition,
          await this.settleGrant(
            definition,
            attempt,
            {
              grant: {
                kind: 'token',
                vaultKey,
                authKind,
                createdAt,
                ...(token.expiresAt !== undefined ? { expiresAt: token.expiresAt } : {}),
                ...(refreshKey !== undefined ? { refreshKey } : {}),
                ...(token.principalId !== undefined ? { principalId: token.principalId } : {})
              },
              secret: token.token
            },
            () => {
              // access·refresh 를 **둘 다 staged 로** 쓴 뒤 promote 가 한 번에 옮긴다 —
              // 하나만 새 값이 되는 상태가 생기지 않는다.
              this.deps.vault.stage(vaultKey, token.token, {
                kind: authKind,
                createdAt,
                ...(token.expiresAt !== undefined ? { expiresAt: token.expiresAt } : {})
              })
              if (refreshKey !== undefined && token.refreshToken !== undefined) {
                this.deps.vault.stage(refreshKey, token.refreshToken, { kind: authKind, createdAt })
              }
            }
          )
        )
      }
      case 'session': {
        // 세션 grant 는 vault 에 값을 쓰지 않는다 — cookie jar 가 값을 나른다. 확인이 끝나기
        // 전에는 store 에도 넣지 않으므로 이전 세션 grant 는 그대로 살아 있다.
        return this.settled(
          definition,
          await this.settleGrant(definition, attempt, {
            grant: {
              kind: 'session',
              sessionGroup: result.sessionGroup,
              authKind,
              createdAt: this.clock(),
              ...(result.principalId !== undefined ? { principalId: result.principalId } : {})
            }
          })
        )
      }
    }
  }

  // 입력 폼이 없는 흐름(OAuth·브라우저 세션)의 확인 실패는 `failed` 다 — 되돌려 보낼 폼이 없고,
  // 사용자는 [연결] 을 다시 눌러 창부터 다시 연다.
  private settled(definition: AuthDefinition, outcome: SettleOutcome): AuthStep {
    if (outcome.kind === 'settled') return outcome.step
    // superseded 는 아무것도 바꾸지 않는다 (r7) — 실패 step 을 내면 늦게 끝난 옛 시도가 이미
    // 성공한 새 로그인이나 해제 직후 화면을 덮어쓴다.
    if (outcome.kind === 'superseded') {
      return this.step ?? { kind: 'done', providerId: definition.id }
    }
    return this.fail(definition.id, 'probe_failed', '인증을 확인하지 못했습니다')
  }

  private commit(authId: AuthId, grant: Grant, notify = true): void {
    this.pending.delete(authId)
    this.deps.store.put(authId, grant)
    if (notify) this.deps.onSnapshot?.(authId, 'credential-committed')
  }

  private fail(authId: AuthId, reason: ProviderFailureReason, message: string): AuthStep {
    this.pending.delete(authId)
    return this.emit({ kind: 'failed', providerId: authId, reason, message })
  }

  private emit(step: AuthStep): AuthStep {
    this.step = step.kind === 'done' ? null : step
    // **step 은 화면만 바꾼다** — `done` 직전의 credential commit 은 `settleGrant` 가 이미
    // snapshot 으로 냈다. 여기서 또 내면 소비자가 같은 변화를 두 번 본다.
    this.deps.onStep?.(this.step)
    return step
  }
}
