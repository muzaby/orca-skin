// 로그인 실행 (0181 → 0188) — `AuthMethod` 분기를 돌려 grant 를 만든다. 인증의 **유일한 입구**다.
//
// 구 구조의 transaction store·loginChain·cascade 는 없다. 상태는 **Auth 당 pending 1건**이
// 전부이고, 그 pending 이 하는 일은 "다음 `continue` 가 어느 방식으로 이어지는가" 하나다.
//
// ── 재인증 의미론 (AC6) ──────────────────────────────────────────────────────
// `reauth` 는 기존 grant 를 **먼저 지우지 않는다**. 새 인증이 성공해야 교체된다 — 실패하면
// 이전 자격증명으로 계속 쓸 수 있어야 하기 때문이다. 입력형 방식에서 "성공" 은 곧 vault 쓰기라,
// compose 가 거부하면 vault 에 손도 대지 않는다.

import { randomBytes } from 'node:crypto'
import type { BrowserSessionPort } from './specs/browser-session'
import type { ProviderFailureReason } from '../../../shared/ipc'
import type {
  AuthDefinition,
  AuthenticatedRequest,
  AuthenticatedResponse,
  AuthId,
  AuthMethod,
  AuthMethodKind,
  AuthRefreshResult,
  AuthSnapshotChangeCause,
  AuthStep,
  Grant,
  TokenValue
} from '../../contracts/auth'
import { errorMessage } from '../../infra/errors'
import {
  providerRefreshKey,
  providerVaultKey,
  versionedVaultKey,
  type Vault
} from '../../infra/vault'
import type { CandidateCredential } from './authenticated-request'
import { isAllowedOrigin } from './policy'
import type { AuthRegistry } from './registry'
import { vaultKeysOf, type AuthStore } from './store'
import { compact, ifPresent } from '../../../shared/obj'

// `Grant` 의 세 갈래. **셋 다** `compact<T>` 로 조립해 필드 규칙이 전 필드를 요구하게 한다 —
// `GrantBase` 에 필드가 늘면 세 리터럴 모두에서 컴파일이 깨진다(0194 r3 신설 · r4 전수).
//
// r3 은 token 갈래만 닫았고, 그래서 `GrantBase` 에 필드를 더해도 깨지는 자리가 하나였다
// (r3 D13). 불변식은 갈래마다가 아니라 **조립마다** 성립해야 한다.
type SecretGrant = Extract<Grant, { kind: 'secret' }>
type TokenGrant = Extract<Grant, { kind: 'token' }>
type SessionGrant = Extract<Grant, { kind: 'session' }>

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
  // 새 vault 키의 세대 토큰(r8). 기본은 프로세스 난수 — 테스트가 결정적 값을 넣는다.
  vaultKeyVersion?: () => string
  oauth?: OAuthAuthenticator
  session?: SessionAuthenticator
  // cookie jar. 해제 시 session grant 의 쿠키를 함께 비운다(r9). 미주입이면 비우지 않는다 —
  // 값형만 쓰는 배포에서는 세션 자체가 없다.
  sessions?: BrowserSessionPort
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

// 세대 토큰의 기본 공급자. 키 이름에만 쓰이고 비밀이 아니지만, 예측 가능한 이름이 여러 설치에서
// 겹치지 않도록 난수를 쓴다.
function defaultVaultKeyVersion(): string {
  return randomBytes(6).toString('hex')
}

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
  // ── cookie cleanup fence (r10) ──────────────────────────────────────────────
  //
  // attempt 세대(위)는 **커밋** 축만 막는다. 쿠키 삭제는 그 축 밖에 있다 — 해제가 시작한
  // `BrowserSessionPort.clear` 는 비동기이고, 그것이 도는 사이 끝난 재로그인의 **새 쿠키를**
  // 지운다(같은 `sessionGroup`·같은 origin 이므로 scope 를 좁혀도 걸린다). 세대로 "늦은 결과를
  // 무시" 할 수 없는 종류다 — 무시할 결과가 아니라 이미 실행 중인 부작용이기 때문이다.
  //
  // key 가 `authId` 가 아니라 `sessionGroup` 인 이유: jar 를 공유하는 것이 그 단위다. 다른
  // Auth 가 같은 그룹으로 로그인해도 같은 삭제에 걸린다.
  private readonly sessionCleanups = new Map<string, Promise<void>>()
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
    return this.currentAttempt(authId) === attempt
  }

  private currentAttempt(authId: AuthId): number {
    return this.attempts.get(authId) ?? 0
  }

  // superseded 가 돌려줄 값. **아무것도 바꾸지 않는다** — pending 도 step 도 이벤트도 그대로
  // 두고 현재 화면 단계를 그대로 돌려준다. renderer 는 요청 순번 가드로 이 응답을 어차피
  // 버리지만, Main 이 push 를 내지 않는 것이 본질이다.
  private supersededStep(authId: AuthId): AuthStep {
    return this.step ?? { kind: 'done', providerId: authId }
  }

  private newVersion(): string {
    return (this.deps.vaultKeyVersion ?? defaultVaultKeyVersion)()
  }

  // 새 자격증명이 앉을 **새 키**. 같은 (authId, authKind) 라도 로그인마다 다르다 — 근거는
  // `infra/vault.ts` 의 `versionedVaultKey`.
  private newVaultKey(authId: AuthId, authKind: AuthMethodKind): string {
    return versionedVaultKey(providerVaultKey(authId, authKind), this.newVersion())
  }

  async begin(
    authId: AuthId,
    authKind?: AuthMethodKind,
    input?: Record<string, string>
  ): Promise<AuthStep> {
    return this.run(authId, authKind, input)
  }

  async continue(authId: AuthId, input: Record<string, string>): Promise<AuthStep> {
    const pending = this.pending.get(authId)
    if (!pending) {
      return this.fail(authId, 'cancelled', '진행 중인 인증이 없습니다')
    }
    return this.run(authId, pending.authKind, input)
  }

  // ── 해제는 성공했을 때만 성공을 발행한다 (r9) ──────────────────────────────
  //
  // r8 은 `store.revoke()` 의 영속 결과를 버리고 무조건 `revoked` 를 냈다. 저장이 실패하면
  // 화면만 '해제됨' 이 되고 디스크의 grant 는 그대로 남아, 재시작하면 연결이 되살아난다 —
  // session grant 는 vault 값도 없어 **아무것도 사라지지 않은 채** 그렇게 된다.
  //
  // 그래서 store 가 영속에 성공한 뒤에만 상태를 바꾸고, 실패는 **던져서** IPC 응답을 실패로
  // 만든다(`handlers/providers.ts` 의 `'reject'` 모드). 사용자가 "끊었다" 고 믿게 두지 않는다.
  //
  // 상태 변경이 store 성공 뒤로 간 것은 안전하다 — `store.revoke()` 는 동기라 그 사이에
  // 끼어들 실행이 없다.
  revoke(authId: AuthId): void {
    const outcome = this.deps.store.revoke(authId)
    if (outcome.kind === 'failed') {
      this.deps.logger?.('auth.revoke.persist-failed', { authId })
      throw new Error('연결 해제를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    this.pending.delete(authId)
    // 진행 중인 probe 의 커밋을 무효화한다 — 해제한 Auth 가 뒤늦은 커밋으로 되살아나면 안 된다.
    this.openAttempt(authId)
    if (this.step?.providerId === authId) {
      this.step = null
      this.deps.onStep?.(null)
    }
    // grant 가 없었으면 아무것도 바뀌지 않았다 — 빈 해제로 Plugin 도구를 다시 sync 하지 않는다.
    if (outcome.kind !== 'revoked') return
    this.deps.onSnapshot?.(authId, 'revoked')
    this.clearSessionCookies(authId, outcome.grant)
  }

  // session grant 를 해제하면 cookie jar 도 비운다 — grant 만 지우면 서버 쪽 로그인은 살아 있다.
  // best-effort 다: 실패해도 해제 자체는 이미 내구적으로 성립했으므로 되돌리지 않는다.
  //
  // **삭제를 기다리지는 않되 추적은 한다** (r10). 해제 IPC 를 네트워크 왕복만큼 붙들 이유는
  // 없지만, 그 사이 시작된 재로그인이 삭제와 겹치면 새 쿠키가 지워진다. 그래서 promise 를
  // sessionGroup 별로 남겨 두고 `runSession` 이 창을 열기 전에 그것을 소진한다.
  private clearSessionCookies(authId: AuthId, grant: Grant): void {
    if (grant.kind !== 'session') return
    const sessions = this.deps.sessions
    if (!sessions) return
    const definition = this.deps.registry.get(authId)
    if (!definition) return
    const onFailed = (error: unknown): void =>
      this.deps.logger?.('auth.revoke.cookie-clear-failed', {
        authId,
        reason: errorMessage(error)
      })
    try {
      const handleId = sessions.acquire(grant.sessionGroup)
      const cleanup = sessions
        .clear(handleId, { scope: 'origin', origin: definition.origin })
        .catch(onFailed)
        .finally(() => {
          // 자기 자신일 때만 지운다 — 뒤이어 등록된 삭제를 덮어쓰지 않는다.
          if (this.sessionCleanups.get(grant.sessionGroup) === cleanup) {
            this.sessionCleanups.delete(grant.sessionGroup)
          }
        })
      this.sessionCleanups.set(grant.sessionGroup, cleanup)
    } catch (error) {
      onFailed(error)
    }
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
  //                        화면에 남으면 안 된다(0187 D2 의 방송 상한 — 정본 `auth.md §5.2`).
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

    // **자동 확인도 세대를 본다** (r8). resume 은 새 시도를 열지 않는다 — 사용자가 이미 시작한
    // 로그인을 부팅 복원이 무효화하면 안 되기 때문이다. 대신 현재 세대를 적어 두고, probe 왕복
    // 동안 사용자가 [연결]·[연결 해제] 를 눌렀으면(둘 다 세대를 올린다) **결과를 버린다** —
    // 옛 자격증명의 probe 결과로 새 자격증명을 `verified` 로 만들지 않는다.
    const attempt = this.currentAttempt(definition.id)
    const ok = await this.probeOk(definition)
    if (!this.isCurrentAttempt(definition.id, attempt)) {
      this.deps.logger?.('auth.resume.attempt-superseded', { authId: definition.id })
      return
    }
    // **전이를 만든 호출만 통지한다** (r4). probe 가 401/403 을 받았거나 세션 체인이 origin 밖에서
    // 끝난 경우 요청 경로가 이미
    // 강등하고 `onUnauthorized` 로 통지했다 — 여기서 다시 내면 같은 사실이 두 번 나가고,
    // 두 번째는 revision 이 그대로라 `credentialChanged:true` 와 어긋난다. 그 유령 이벤트가
    // 부팅 방송 상한(0187 D2)의 강등 항 K 를 2K 로 늘리고 Harness cache 를 한 번 더 비웠다.
    //
    // 요청 경로가 강등하는 경우는 둘이다 — 401/403, 그리고 **세션 grant 의 origin 미복귀**
    // (0195 D-004). 그 밖의 실패(비-2xx·전송 오류·정책 위반)에서는 여기가 유일한 전이 지점이고,
    // 어느 쪽이든 `markExpired` 가 "이번 호출이 전이를 만들었는가" 를 보고하므로 통지는 한 번만
    // 나간다 — 요청 경로가 이미 정착시켰으면 여기서는 `credentialChanged:false` 다.
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

  // ── 만료된 token grant 의 갱신 (0194) ───────────────────────────────────────
  //
  // **창을 열지 않는다.** 그래서 부팅 복원의 회복 경로가 재로그인보다 먼저 이것을 부른다 —
  // 성공하면 사용자는 아무것도 보지 못하고 연결이 살아난다.
  //
  // 가능 판정이 **여기 한 곳**에 있다(계약 §10). 호출자(`app/auth-resume.ts`)는 결과 3분기만
  // 보고, `refreshKey` 유무나 만료를 스스로 다시 판정하지 않는다 — 두 벌이 되면 갈린다.
  //
  // **`settled()` 를 쓰지 않는 이유**: 그 경로의 `rejected` 는 `fail()` 을 거쳐 전역 `failed`
  // step 을 emit 한다. 사용자가 시작하지도 않은 조용한 갱신이 화면에 "인증을 확인하지
  // 못했습니다" 를 띄우면 안 된다. 그래서 `settleGrant` 의 3분기를 직접 접는다 — 커밋 규칙
  // 자체(새 키 2개 · probe 통과 후 커밋)는 `tokenCandidate`+`settleGrant` 가 그대로 갖는다.
  async refresh(authId: AuthId): Promise<AuthRefreshResult> {
    const definition = this.deps.registry.get(authId)
    if (!definition) return 'unsupported'
    const grant = this.deps.store.get(authId)
    // 값형·세션 grant 에는 refresh 라는 개념이 없다. `authKind` 까지 보는 이유는 세션 교환이
    // 만든 token grant(`authKind:'browser-session'`)를 oauth 선언의 refresh 로 갱신하면
    // 자격증명 계보가 섞이기 때문이다.
    if (!grant || grant.kind !== 'token' || grant.authKind !== 'oauth') return 'unsupported'
    const spec = definition.methods.find((method): method is OAuthSpec => method.kind === 'oauth')
    if (!spec?.refresh) return 'unsupported'
    // 없음·만료·복호화 실패가 전부 여기서 접힌다(`AuthStore.refreshSecret`).
    const refreshToken = this.deps.store.refreshSecret(authId)
    if (refreshToken === null) return 'unsupported'

    // 갱신도 **세대를 연다** — 도는 사이 사용자가 직접 로그인했거나 해제했으면 커밋되지 않는다.
    const attempt = this.openAttempt(authId)
    let token: TokenValue
    try {
      token = await spec.refresh(refreshToken)
    } catch (error) {
      this.deps.logger?.('auth.refresh.threw', { authId, reason: errorMessage(error) })
      return 'failed'
    }
    // **응답이 새 refresh token 을 주지 않으면 보내던 것을 계속 쓴다** (0194 D-014). RFC 6749
    // §6 은 새 refresh token 발급을 선택으로 두므로, 회전하지 않는 서버의 정상 응답에는 access
    // token 만 온다. 그것을 "refresh token 없음" 으로 커밋하면 갱신 한 번에 회복 능력을 잃고
    // 두 번째 만료부터 로그인 창밖에 길이 없다(r1 D1).
    //
    // **옛 키를 계속 가리키지 않고 값을 새 세대 키로 옮겨 적는다.** `settleGrant` 의 되돌리기는
    // "새 자격증명이 이름 붙인 자리는 전부 버려도 된다" 를 전제하므로(`discardKeys(candidate.grant)`,
    // `keep` 없음), 옛 키를 공유하면 갱신 실패가 **살아 있는 옛 grant 의 자리**를 지운다.
    //
    // **최초 로그인·재인증(`absorbToken`)에는 이 승계가 없다** — 그쪽은 새 인가라 옛 refresh
    // token 이 다른 계보이고, 이미 폐기됐을 수 있는 값을 새 자격증명이 물고 가면 안 된다.
    const carried: TokenValue =
      token.refreshToken !== undefined
        ? token
        : {
            ...token,
            refreshToken,
            // 만료도 **함께** 옮긴다 — 값만 옮기면 "만료를 모른다" 가 되어 죽은 토큰으로 매번
            // 왕복을 한 번씩 쓴다(D-009). 응답이 새 만료를 줬으면 그것이 이긴다: 회전 없이
            // 만료만 늘려 주는 서버가 있다.
            ...ifPresent('refreshExpiresAt', token.refreshExpiresAt ?? grant.refreshExpiresAt)
          }
    const { candidate, writeVault } = this.tokenCandidate(authId, 'oauth', carried, grant)
    const outcome = await this.settleGrant(definition, attempt, candidate, writeVault)
    this.deps.logger?.('auth.refresh.result', { authId, outcome: outcome.kind })
    // superseded 는 실패가 아니다 — 사용자의 새 시도가 이미 이겼으므로 회복은 그 자리에서
    // 그만두면 된다. 재로그인으로 넘어가면 사용자의 로그인을 덮는다.
    if (outcome.kind === 'superseded') return 'unsupported'
    return outcome.kind === 'settled' ? 'refreshed' : 'failed'
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
        { path: probe.path, ...ifPresent('method', probe.method) },
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
  //
  // ── 커밋은 포인터 교체다 (r8, D-050) ────────────────────────────────────────
  // r7 은 확인된 값을 staged 에 쓴 뒤 **고정 키로 promote** 하고 그 다음 grant 를 저장했다.
  // 그래서 promote 와 grant 저장 사이에 창이 남았다 — grant 저장이 실패하면 vault 에는 새 값,
  // 영속된 grant 에는 옛 값이 남는다(실측 재현됨). 두 저장소를 원자적으로 함께 쓸 방법이 없는
  // 한 고정 키를 덮어쓰는 설계는 이 창을 닫을 수 없다.
  //
  // 그래서 **새 값은 새 키에 쓰고, grant 저장이 곧 커밋**이다. 실패 지점이 어디든 결과는 둘 중
  // 하나뿐이고 둘 다 정합적이다 — 옛 grant→옛 키, 또는 새 grant→새 키. 고아 키는 다음 부팅의
  // sweep 이 치운다(`AuthStore.restore`).
  private async settleGrant(
    definition: AuthDefinition,
    attempt: number,
    candidate: CandidateCredential,
    writeVault?: () => void
  ): Promise<SettleOutcome> {
    const probeOk = await this.probeOk(definition, candidate)
    // **세대 확인이 결과 해석보다 먼저다** (r8). r7 은 실패 분기를 먼저 처리해서, 늦게 끝난 옛
    // 시도의 401 이 이미 성공한 새 로그인 위에 거부 폼을 다시 열었다 — 해제 직후에도 열렸다
    // (`status=none` 인데 `input-required`). superseded 는 성공이든 실패든 **아무것도 하지 않는다.**
    if (!this.isCurrentAttempt(definition.id, attempt)) {
      this.deps.logger?.('auth.login.attempt-superseded', { authId: definition.id })
      return { kind: 'superseded' }
    }
    if (!probeOk) {
      // 아무것도 쓰지 않았다 — 이전 자격증명은 손대지 않은 채 그대로 살아 있다.
      // 통지는 호출자의 `emit`(폼 재표시 또는 `failed`)이 한다 — 두 번 쏘지 않는다.
      return { kind: 'rejected' }
    }
    // 확인된 값을 **아무도 가리키지 않는 새 키**에 쓴다. 여기서 실패하면 옛 키는 그대로다.
    if (writeVault) {
      try {
        writeVault()
      } catch (error) {
        this.discardKeys(candidate.grant)
        this.deps.logger?.('auth.login.vault-write-failed', {
          authId: definition.id,
          reason: errorMessage(error)
        })
        return { kind: 'rejected' }
      }
    }
    // 옛 키는 커밋이 **내구 저장으로** 성립한 뒤에만 지운다.
    const previous = this.deps.store.get(definition.id)
    let durable: boolean
    try {
      // `put` 은 영속을 먼저 하고 메모리를 나중에 바꾼다 — 저장이 실패하면 메모리도 그대로다.
      durable = this.commit(definition.id, candidate.grant, false)
    } catch (error) {
      this.discardKeys(candidate.grant)
      this.deps.logger?.('auth.login.persist-failed', {
        authId: definition.id,
        reason: errorMessage(error)
      })
      return { kind: 'rejected' }
    }
    if (durable) this.discardKeys(previous, candidate.grant)
    else {
      // 메모리로만 저장됐다 — 이 프로세스는 새 값으로 동작하지만 재시작하면 옛 grant 가 돌아온다.
      // 그러니 **옛 키를 지우지 않는다**. 지우면 재시작 후 아무것도 가리키지 않는 grant 가 된다.
      this.deps.logger?.('auth.login.persist-degraded', { authId: definition.id })
    }
    this.deps.onSnapshot?.(definition.id, 'credential-committed')
    return { kind: 'settled', step: this.emit({ kind: 'done', providerId: definition.id }) }
  }

  // secret grant 조립 — **한 곳** (0190 S6).
  //
  // 값형 로그인(`runCredential`)과 실행기의 `secret` 결과(`absorb`)가 같은 것을 만든다: 같은
  // 세대 키 도출, 같은 grant 모양, 같은 vault 쓰기. 0188 은 이것을 두 벌로 적었고, 세대 키(r8)를
  // 도입할 때 두 사본을 각각 고쳐야 했다 — 한쪽만 고쳤으면 OAuth 경로만 고정 키를 계속 덮어써
  // "vault 는 새 값, 영속된 grant 는 옛 값" 창이 그 경로에만 남았을 것이다.
  //
  // candidate 와 vault 쓰기를 **함께** 돌려준다. 둘이 같은 `vaultKey`·`createdAt` 을 봐야 하는데
  // 따로 만들면 호출부가 그 짝을 손으로 맞춰야 한다.
  private secretCandidate(
    authId: AuthId,
    authKind: AuthMethodKind,
    value: string,
    principalId?: string
  ): { candidate: CandidateCredential; writeVault: () => void } {
    const vaultKey = this.newVaultKey(authId, authKind)
    const createdAt = this.clock()
    // 필드 규칙 — 필드마다 한 줄, 빠짐없이 (0194 r4 · `tokenCandidate` 와 같은 형식).
    const grant = compact<SecretGrant>({
      kind: 'secret',
      vaultKey,
      authKind,
      createdAt,
      // 값형 자격증명은 만료를 **선언하지 않는다**. 이 필드는 401 관측이 `markExpired` 로
      // 채우는 자리이지 발급 시점에 아는 값이 아니다.
      expiresAt: undefined,
      principalId
    })
    return {
      candidate: { grant, secret: value },
      writeVault: () => this.deps.vault.set(vaultKey, value, { kind: authKind, createdAt })
    }
  }

  // grant 가 가리키는 vault 키를 지운다. `keep` 이 같은 키를 가리키면 건너뛴다 — 세대가 같은
  // 경우(레거시 고정 키에서 같은 키로 다시 쓴 경우)에 방금 쓴 값을 지우지 않기 위함이다.
  private discardKeys(grant: Grant | undefined, keep?: Grant): void {
    const kept = new Set(vaultKeysOf(keep))
    for (const name of vaultKeysOf(grant)) {
      if (kept.has(name)) continue
      try {
        this.deps.vault.delete(name)
      } catch {
        // 못 지워도 정합성은 유지된다 — 아무도 가리키지 않는 자리이고 sweep 이 다시 시도한다.
      }
    }
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

    const { candidate, writeVault } = this.secretCandidate(
      definition.id,
      spec.kind,
      composed.value,
      composed.principalId
    )
    const settled = await this.settleGrant(definition, attempt, candidate, writeVault)
    if (settled.kind === 'settled') return settled.step
    // superseded — 이 시도는 더 이상 사용자가 원하는 것이 아니다. pending·step·이벤트 **전부
    // 건드리지 않고** 현재 단계를 그대로 돌려준다(r7). 거부 폼을 열면 이미 성공한 새 로그인의
    // 화면을 덮는다.
    if (settled.kind === 'superseded') return this.supersededStep(definition.id)

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
    // **해제가 시작한 쿠키 삭제가 끝난 뒤에 창을 연다** (r10). 아래 `clearSessionCookies` 는
    // fire-and-forget 이고 `BrowserSessionPort.clear` 는 실제로 비동기다 — 해제 직후 곧바로
    // 재인증하면 그 삭제가 **새로 받은 쿠키를 뒤늦게 지운다**(같은 origin·같은 jar). 세대 비교로
    // "늦은 것을 무시" 하는 방식은 여기서 통하지 않는다: 이미 시작된 삭제 자체를 되돌릴 수 없다.
    // 그래서 무시가 아니라 **순서를 보장**한다.
    await this.settleSessionCleanup(spec.config.sessionGroup)
    return this.absorb(definition, attempt, spec.kind, await authenticator.login(definition, spec))
  }

  // 진행 중인 쿠키 삭제를 기다린다. 실패한 삭제도 "끝났다" 로 친다 — 정리 실패가 재인증을
  // 막으면 사용자가 빠져나갈 길이 없다.
  private async settleSessionCleanup(sessionGroup: string): Promise<void> {
    const pending = this.sessionCleanups.get(sessionGroup)
    if (!pending) return
    await pending
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
    // **실행기 await 뒤에도 세대를 확인한다** (r8). OAuth `begin`/`complete` 와 브라우저 세션
    // `login` 은 왕복이 길다 — 그 사이 사용자가 [연결 해제] 를 눌렀거나 다시 [연결] 했으면,
    // 늦게 끝난 이 결과가 `code-required` 로 pending 을 되살리거나 `failed` 로 새 흐름의 화면을
    // 덮는다. 성공 분기는 아래 `settleGrant` 가 한 번 더 확인하므로 여기 검사가 이중이 아니라
    // **실패·중간 분기를 위한 것**이다.
    if (!this.isCurrentAttempt(definition.id, attempt)) {
      this.deps.logger?.('auth.login.attempt-superseded', { authId: definition.id })
      return this.supersededStep(definition.id)
    }
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
        const { candidate, writeVault } = this.secretCandidate(
          definition.id,
          authKind,
          result.value,
          result.principalId
        )
        return this.settled(
          definition,
          await this.settleGrant(definition, attempt, candidate, writeVault)
        )
      }
      case 'token':
        return this.absorbToken(definition, attempt, authKind, result.token)
      case 'session': {
        // 세션 grant 는 vault 에 값을 쓰지 않는다 — cookie jar 가 값을 나른다. 확인이 끝나기
        // 전에는 store 에도 넣지 않으므로 이전 세션 grant 는 그대로 살아 있다.
        //
        // 필드 규칙 — 필드마다 한 줄, 빠짐없이 (0194 r4 · `tokenCandidate` 와 같은 형식).
        const grant = compact<SessionGrant>({
          kind: 'session',
          sessionGroup: result.sessionGroup,
          authKind,
          createdAt: this.clock(),
          // 세션의 만료는 서버의 cookie 가 갖고 앱은 그것을 읽지 못한다 — probe 실패가
          // `markExpired` 로 채우는 자리다.
          expiresAt: undefined,
          principalId: result.principalId
        })
        return this.settled(definition, await this.settleGrant(definition, attempt, { grant }))
      }
    }
  }

  // token grant 조립 (0190 S7 — `absorb` 에서 분리).
  //
  // 네 갈래 중 이것만 **키가 둘**이다(access + refresh). 그 분기가 `absorb` 안에 있던 동안
  // switch 한 case 가 60줄이었고 중첩이 네 겹이었다 — 아래 "둘 다 새 키에" 규칙이 그 바닥에
  // 묻혀 있었다.
  private async absorbToken(
    definition: AuthDefinition,
    attempt: number,
    authKind: AuthMethodKind,
    token: TokenValue
  ): Promise<AuthStep> {
    const { candidate, writeVault } = this.tokenCandidate(definition.id, authKind, token)
    return this.settled(
      definition,
      await this.settleGrant(definition, attempt, candidate, writeVault)
    )
  }

  // token grant 의 candidate + vault 쓰기 (0194 — `absorbToken` 에서 분리).
  //
  // `secretCandidate` 와 같은 이유로 갈랐다: **소비자가 둘**이 됐다(최초 로그인 `absorbToken`,
  // 갱신 `refresh`). 아래 "둘 다 새 키에" 규칙이 두 벌이 되면 한쪽만 고쳐지고, 그때 그 경로에만
  // `new-access + old-refresh` 혼합 상태가 남는다.
  private tokenCandidate(
    authId: AuthId,
    authKind: AuthMethodKind,
    token: TokenValue,
    previous?: Grant
  ): { candidate: CandidateCredential; writeVault: () => void } {
    const vaultKey = this.newVaultKey(authId, authKind)
    const createdAt = this.clock()
    const refreshKey =
      token.refreshToken !== undefined
        ? versionedVaultKey(providerRefreshKey(authId, authKind), this.newVersion())
        : undefined
    // ── 새 grant 의 **필드 규칙** — 필드마다 한 줄, 빠짐없이 (0194 r3) ───────────────
    //
    // 옛 구조는 빈 객체에 `...ifPresent()` 를 쌓아 올렸다. 그래서 **응답이 말하지 않은 필드는
    // 조용히 사라졌다** — D1(`refreshToken`)·D7(`principalId`)이 같은 문장의 다른 필드였다.
    // 여기서는 `compact` 의 인자 타입이 전 필드를 요구하므로, `Grant` 에 필드를 더하면
    // **이 리터럴에서 컴파일이 깨진다**. 규칙을 못 적고 지나갈 자리가 없다.
    //
    // `previous` 는 **갱신(`refresh`)만** 넘긴다. 최초 로그인·재인증(`absorbToken`)은 새 인가라
    // 옛 자격증명의 어떤 값도 물려받지 않는다(D-014 의 "갱신 경로에만" 이 호출부로 지켜진다).
    const grant = compact<TokenGrant>({
      kind: 'token',
      vaultKey,
      authKind,
      createdAt,
      // **응답 전용 — 승계 금지.** `markExpired` 가 강등 시점에 `expiresAt` 을 `now` 로 못 박으므로
      // (`store.ts`), 그 지난 값을 새 access token 에 물리면 갱신 직후 만료 상태로 태어난다.
      expiresAt: token.expiresAt,
      refreshKey,
      // refresh 키가 없으면 그 만료도 의미가 없다 — 짝으로만 싣는다. 미회전 응답의 옛 만료 승계는
      // `refresh` 가 `token` 을 정규화하며 이미 끝냈다(D-014).
      refreshExpiresAt: refreshKey !== undefined ? token.refreshExpiresAt : undefined,
      // **승계** — 계정 신원은 갱신으로 바뀌지 않는다. 응답이 다시 말하면 그것이 이긴다.
      principalId: token.principalId ?? previous?.principalId
    })
    return {
      candidate: { grant, secret: token.token },
      // access·refresh 를 **둘 다 새 키에** 쓴다. 어느 쪽이 실패해도 아직 grant 가 가리키지 않는
      // 자리이므로 옛 access/refresh 쌍은 통째로 그대로 살아 있다 — r6 의 `new-access +
      // old-refresh` 혼합 상태가 만들어질 자리가 없다.
      writeVault: (): void => {
        this.deps.vault.set(vaultKey, token.token, {
          kind: authKind,
          createdAt,
          ...ifPresent('expiresAt', token.expiresAt)
        })
        if (refreshKey !== undefined && token.refreshToken !== undefined) {
          this.deps.vault.set(refreshKey, token.refreshToken, { kind: authKind, createdAt })
        }
      }
    }
  }

  // 입력 폼이 없는 흐름(OAuth·브라우저 세션)의 확인 실패는 `failed` 다 — 되돌려 보낼 폼이 없고,
  // 사용자는 [연결] 을 다시 눌러 창부터 다시 연다.
  private settled(definition: AuthDefinition, outcome: SettleOutcome): AuthStep {
    if (outcome.kind === 'settled') return outcome.step
    // superseded 는 아무것도 바꾸지 않는다 (r7) — 실패 step 을 내면 늦게 끝난 옛 시도가 이미
    // 성공한 새 로그인이나 해제 직후 화면을 덮어쓴다.
    if (outcome.kind === 'superseded') return this.supersededStep(definition.id)
    return this.fail(definition.id, 'probe_failed', '인증을 확인하지 못했습니다')
  }

  private commit(authId: AuthId, grant: Grant, notify = true): boolean {
    this.pending.delete(authId)
    const durable = this.deps.store.put(authId, grant)
    if (notify) this.deps.onSnapshot?.(authId, 'credential-committed')
    return durable
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
