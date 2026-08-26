// 부팅 Auth 복원 순서 (0188 — 구 `LoginService.resume` + `sweepPlugins`).
//
// ── 왜 app 레이어인가 ────────────────────────────────────────────────────────
// "게이트가 먼저" 는 **제품 정책**이지 인증 lifecycle 이 아니다. 0181 은 이것을
// `LoginService` 안에 뒀고, 그래서 인증 코어가 `registry.byKind('gate')` 를 알아야 했다.
// 여기로 옮기면 Auth 는 "Auth 하나를 확인한다" 만 알면 된다.
//
// ── 순서가 규칙인 이유 ───────────────────────────────────────────────────────
// 사내 서비스는 대개 게이트와 *같은 cookie jar* 를 쓴다(`sessionGroup` 공유). 로그인 전에
// 물으면 살아 있는 연결도 미인증으로 떨어지고, 한 번 강등되면 요청 정책이 막아 스스로
// 회복하지 못한다(401 강등과 같은 성질 — 회복은 재인증뿐이다).
//
// **게이트끼리는 순차, 나머지끼리는 병렬**이다. 나머지를 순차로 돌면 probe 타임아웃이 Auth
// 수만큼 직렬로 쌓여(연결 안 되는 망에서 N×15초) 그동안 Plugin 도구가 뜨지 않는다.
//
// ── 방송을 합치는 이유 (0187 D2 승계) ────────────────────────────────────────
// 나머지 batch 의 **성공한 `verified` 변화는 마지막 push 한 번**으로 합친다. 실패 강등은
// credential-effective 라 그 자리에서 즉시 push 된다(죽은 연결의 도구가 남은 probe 의
// 타임아웃만큼 화면에 남으면 안 된다). 루프 안에서 매번 부르는 것보다 항상 적다.
//
// **횟수는 여기 적지 않는다.** 상한의 정본은 `docs/arch/backend/auth.md §5.2` 와
// `auth-resume.test.ts` 의 방송 상한 describe 다 — 사본을 두면 갈린다(0194 D3: 이 주석이
// "재로그인이 0건이면 상한은 그대로" 라 적은 동안 종료 push 는 이미 무조건이었다).
//
// ── 복원 실패의 회복 (0193) ─────────────────────────────────────────────────
// probe 가 실패하면 grant 는 `expired` 로 강등되고, 그 뒤로는 요청 정책이 막아 **스스로 회복하지
// 못한다**(위 401 강등과 같은 성질). 그런데 나머지 Auth 는 대개 게이트와 같은 cookie jar 를
// 쓰므로, 게이트 로그인 직후라면 같은 자리에서 **다시 로그인하는 것만으로** 살아나는 경우가 많다.
//
// 그래서 강등된 Auth 만 모아 다시 로그인한다. **순차인 이유는 창 때문이다** —
// `browser-session` 로그인은 실제로 보이는 창을 열어서(`infra/browser-session.ts`) 병렬로 돌리면
// 창이 동시에 여러 개 뜬다. `probe_failed` 가 아닌 결말은 남은 횟수와 무관하게 그 자리에서
// 멈춘다: 사용자가 닫은 창을 다시 열지 않는다.
//
// 이 모듈은 **electron 을 물지 않는다** — bootstrap 인라인이면 순서와 방송 횟수를 사람 실기로만
// 확인할 수 있다.

import type {
  AuthDefinition,
  AuthId,
  AuthMethodKind,
  AuthRefreshResult,
  AuthRuntime,
  AuthStep
} from '../contracts/auth'
import { errorMessage } from '../infra/errors'
import { ifPresent } from '../../shared/obj'

// 한 Auth 가 자동으로 다시 로그인해 볼 수 있는 횟수 (사용자 결정 2026-08-20).
const MAX_RELOGIN_ATTEMPTS = 3

// **사용자 입력 없이 완주할 수 있는 방식만** 자동으로 다시 시도한다. 입력형(api-key·password·pat)
// 은 입력 없이 `login` 을 부르면 네트워크를 타지 않고 `input-required` step 만 만드는데, 그 step
// 은 전역 단일 값이라(`app/connection-views.ts`) 회복 대신 **사용자가 요청하지 않은 입력 폼**이
// 뜬다.
const AUTO_RELOGIN_KINDS: ReadonlySet<AuthMethodKind> = new Set<AuthMethodKind>([
  'browser-session',
  'oauth'
])

// **`methods[0]` 를 본다** — 실제 로그인도 방식을 지정하지 않으면 같은 첫 방식을 고른다
// (`features/auth/login.ts` 의 `run`). 여기서 kind 를 인자로 넘기면 방식 선택 규칙이 두 벌이 되고,
// 그 둘은 언젠가 갈린다.
function autoReloginable(definition: AuthDefinition): boolean {
  const firstMethod = definition.methods[0]
  return firstMethod !== undefined && AUTO_RELOGIN_KINDS.has(firstMethod.kind)
}

export interface ResumeAuthDeps {
  auth: AuthRuntime
  // 필수 gate — 순차로 먼저 확인한다. `resuming` step 을 노출해 로그인 화면이 진행을 보인다.
  gateDefinitions: readonly AuthDefinition[]
  // 나머지 — gate 통과 뒤 한 번 병렬 확인한다.
  remainingDefinitions: readonly AuthDefinition[]
  // 마지막 full-state 방송.
  pushConnectionState: () => void
  // remaining batch가 방송을 합쳐도 성공한 verified 전이는 catalog에 별도로 전달한다.
  reconcileVerified: (authId: AuthId) => void
  // 자동 재로그인 진단. 미주입이면 남기지 않는다 — 동작은 같다.
  logger?: (event: string, data: Record<string, unknown>) => void
}

// gate 통과 판정. **bypass 는 보지 않는다** — 우회로 열린 게이트가 나머지 Auth 의 복원 probe 를
// 트리거하면, 실제로는 사내망에 못 나가는 상태에서 전부 강등된다(그리고 회복은 재인증뿐이다).
export function gateOpen(auth: AuthRuntime, gateDefinitions: readonly AuthDefinition[]): boolean {
  if (gateDefinitions.length === 0) return true
  return gateDefinitions.every((definition) => {
    const snapshot = auth.tryBind(definition.id)?.snapshot()
    return snapshot?.status === 'valid' && snapshot.verified
  })
}

export interface AuthResumeHandle {
  // 부팅 1회. **await 하지 않는 호출자를 전제로 던지지 않는다.**
  run(): Promise<void>
  // gate 가 나중에 열린 경우(사용자가 로그인 버튼을 누름)의 재진입. 같은 batch 를 두 번 돌지
  // 않도록 Promise 를 기억한다.
  onGateChange(authId: AuthId): void
  // 게이트는 열렸는데 나머지 복원이 아직 안 끝났는가 (0194). GUI 가 이 값이 참인 동안 메인
  // 셸 대신 대기 화면을 유지한다.
  resuming(): boolean
}

export function createAuthResume(deps: ResumeAuthDeps): AuthResumeHandle {
  const gateIds = new Set(deps.gateDefinitions.map((definition) => definition.id))
  let remainingResume: Promise<void> | null = null
  let remainingSettled = false

  // probe 실패의 결과만 재로그인 대상이다. `expired` 가 아니면 그 사이 **사용자가 개입한 것**이다
  // — `none` 은 [연결 해제](끊은 연결을 되살리지 않는다), `valid` 는 사용자가 직접 시작한 로그인
  // (그 경우 `resume` 은 세대가 밀려 아무것도 바꾸지 않고 끝났다. 새 attempt 로 덮지 않는다).
  const isDemoted = (definition: AuthDefinition): boolean =>
    deps.auth.tryBind(definition.id)?.snapshot().status === 'expired'

  // 한 Auth 의 재로그인. 마지막 방송이 무조건 일어나게 바뀌어(0194) 시도 여부를 돌려줄 이유가
  // 없어졌다 — 0193 의 `attempted` 누적은 함께 사라졌다.
  //
  // **이름에 `Once` 를 붙이지 않는다** (0197 C-1) — 아래 루프가 `MAX_RELOGIN_ATTEMPTS` 회 돈다.
  // 아래 `refreshOnce` 는 실제로 1회라 두 이름의 비대칭이 몸통의 비대칭과 맞는다.
  const relogin = async (definition: AuthDefinition): Promise<void> => {
    for (let attempt = 1; attempt <= MAX_RELOGIN_ATTEMPTS; attempt += 1) {
      // **매 시도 직전에 다시 읽는다** — 순차 루프라 시도와 시도 사이에 사용자 조작이 끼어든다.
      if (!isDemoted(definition)) return
      deps.logger?.('auth.resume.relogin.start', { authId: definition.id, attempt })
      // **로그인은 던질 수 있다.** `resume` 과 달리 `login` 에는 "부팅 경로라 던지지 않는다" 는
      // 계약이 없고, 그 아래에는 주입 포트를 try 밖에서 부르는 자리가 있다 — `oauth-runner.ts`
      // 의 `states.issue`·`listen` 이 그렇다. 여기는 `void run()` 으로 불리는 fire-and-forget
      // 경로라, 흘려보내면 unhandled rejection 이 되고 **남은 후보의 재로그인과 마지막 방송이
      // 통째로 건너뛰어진다**. 그래서 사용자가 그만둔 것과 같은 취급으로 접는다.
      let step: AuthStep
      try {
        // 방식을 넘기지 않는 것이 곧 `methods[0]` 다 (위 `autoReloginable` 주석).
        step = await deps.auth.login(definition.id)
      } catch (error) {
        deps.logger?.('auth.resume.relogin.threw', {
          authId: definition.id,
          attempt,
          reason: errorMessage(error)
        })
        return
      }
      deps.logger?.('auth.resume.relogin.result', {
        authId: definition.id,
        attempt,
        step: step.kind,
        ...ifPresent('reason', step.kind === 'failed' ? step.reason : undefined)
      })
      // 확인만 실패한 것이면 다시 해 볼 여지가 있다. 그 밖의 결말은 사용자를 기다리거나
      // (`input-required`·`code-required`) 사용자가 이미 그만둔 것이다(`cancelled`·`unsupported`).
      if (step.kind !== 'failed' || step.reason !== 'probe_failed') return
    }
  }

  // 한 Auth 의 refresh. **1회뿐이다** (D-010) — 같은 refresh token 을 다시 보내도 서버 판정이
  // 같으므로 루프를 두지 않는다. 루프가 없는 것이 곧 상한이다.
  //
  // 가능 판정(`refreshKey` 유무·만료·선언 구현)은 **여기서 하지 않는다** — `LoginService.refresh`
  // 한 곳이 갖는다(계약 §10). 두 벌이 되면 갈린다.
  const refreshOnce = async (definition: AuthDefinition): Promise<boolean> => {
    deps.logger?.('auth.resume.refresh.start', { authId: definition.id })
    let result: AuthRefreshResult
    try {
      // `login` 과 같은 이유로 감싼다 — `void run()` 경로라 흘려보내면 남은 후보의 회복과
      // 마지막 방송이 통째로 사라진다.
      result = await deps.auth.refresh(definition.id)
    } catch (error) {
      deps.logger?.('auth.resume.refresh.threw', {
        authId: definition.id,
        reason: errorMessage(error)
      })
      return false
    }
    deps.logger?.('auth.resume.refresh.result', { authId: definition.id, result })
    return result === 'refreshed'
  }

  // 만료된 Auth 를 **순차로** 회복한다 — 창이 동시에 여러 개 뜨지 않게(헤더 참조).
  //
  // **probe 후보 배열이 아니라 `remainingDefinitions` 전체를 훑는다** (0194). 부팅 시점에 이미
  // 시계상 만료된 grant 는 `status !== 'valid'` 라 probe 후보에 애초에 들어오지 못하는데,
  // 0193 은 그 후보 배열을 그대로 회복 대상으로 썼다 — 그래서 앱이 꺼져 있는 동안 토큰이
  // 만료된 경우가 통째로 회복 대상 밖이었다. 회복이 물어야 할 것은 "지금 만료인가" 하나다.
  const recoverExpired = async (): Promise<void> => {
    for (const definition of deps.remainingDefinitions) {
      if (!isDemoted(definition)) continue
      // refresh 가 먼저다 — 창을 열지 않으므로 성공하면 사용자가 아무것도 보지 못한다.
      //
      // **`autoReloginable` 게이트를 적용하지 않는다** (D-012). 그 게이트가 입력형을 막는
      // 이유는 "사용자가 요청하지 않은 입력 폼이 전역 방송된다" 인데, refresh 는 창·폼·step
      // 을 만들지 않아 그 이유가 성립하지 않는다. 대상 판정은 grant 가 한다.
      if (await refreshOnce(definition)) continue
      if (!autoReloginable(definition)) continue
      await relogin(definition)
    }
  }

  const resumeRemainingOnce = async (): Promise<void> => {
    try {
      const probeTargets = deps.remainingDefinitions.filter((definition) => {
        if (!definition.probe) return false
        const snapshot = deps.auth.tryBind(definition.id)?.snapshot()
        // 이미 확인된 것과 grant 가 없는 것은 물어볼 이유가 없다. `status !== 'valid'` 면 정책이
        // 요청 자체를 막으므로 물어볼 수도 없다.
        return snapshot?.status === 'valid' && !snapshot.verified
      })
      // **조기 반환하지 않는다** — probe 할 것이 없어도 회복할 것은 있을 수 있다(위 주석).
      if (probeTargets.length > 0) {
        await Promise.all(
          probeTargets.map((definition) =>
            deps.auth.resume(definition.id, { exposeStep: false, emitVerifiedChange: false })
          )
        )
        for (const definition of probeTargets) {
          const snapshot = deps.auth.tryBind(definition.id)?.snapshot()
          if (snapshot?.status === 'valid' && snapshot.verified) {
            deps.reconcileVerified(definition.id)
          }
        }
        // 성공한 probe 들의 상태는 **회복 전에** 화면에 도달한다 — 재로그인은 로그인 창
        // 타임아웃만큼 길어질 수 있고, 그동안 살아 있는 연결까지 붙들려 있으면 안 된다.
        deps.pushConnectionState()
      }
      await recoverExpired()
    } finally {
      // **`finally` 여야 한다** — 여기서 새는 예외 하나가 `resuming` 을 참으로 굳히면 앱이
      // 대기 화면에 영구히 잠긴다(§10 강제 지점).
      remainingSettled = true
      // 복원 종료를 알리는 마지막 방송. 0193 의 조건부 `attempted` push 를 **대체**한다 —
      // 시도가 없었어도 `resuming: true` 는 이미 나갔으므로 그것을 거두는 push 가 필요하다.
      deps.pushConnectionState()
    }
  }

  const startRemaining = (): Promise<void> => (remainingResume ??= resumeRemainingOnce())

  return {
    async run(): Promise<void> {
      for (const definition of deps.gateDefinitions) {
        await deps.auth.resume(definition.id, { exposeStep: true, emitVerifiedChange: true })
      }
      if (gateOpen(deps.auth, deps.gateDefinitions)) await startRemaining()
    },
    onGateChange(authId: AuthId): void {
      if (!gateIds.has(authId)) return
      if (gateOpen(deps.auth, deps.gateDefinitions)) void startRemaining()
    },
    // **파생값이지 플래그가 아니다.** 별도 boolean 을 두면 "게이트가 열렸다" 를 방송하는 구독자와
    // 배치를 시작하는 구독자의 **등록 순서에 정답이 생기고**, 순서가 뒤집히면
    // `{passed:true, resuming:false}` 가 한 번 나가 메인 셸이 한 프레임 번쩍인다.
    // `gateOpen()` 은 store 를 동기로 읽으므로 게이트가 열린 그 change 시점에 이미 참이고,
    // 그래서 어느 구독자가 먼저 돌든 같은 값이 나간다.
    //
    // `gateOpen()` 재사용이 **bypass 잠김도 함께 막는다** — 우회로 `passed:true` 가 된 빌드는
    // gate 선언이 미검증이라 `gateOpen()` 이 거짓이고, 그런 빌드는 배치를 아예 돌리지 않으므로
    // 대기 화면에 갇히면 안 된다.
    resuming(): boolean {
      return !remainingSettled && gateOpen(deps.auth, deps.gateDefinitions)
    }
  }
}
