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
// ── 방송 상한 `1 + K` (0187 D2 승계) ─────────────────────────────────────────
// 나머지 batch 의 **성공한 `verified` 변화는 마지막 push 한 번**으로 합친다. 실패 강등 K 건은
// credential-effective 라 그 자리에서 즉시 push 된다(죽은 연결의 도구가 남은 probe 의
// 타임아웃만큼 화면에 남으면 안 된다). 그래서 총 방송은 `1 + K` — 루프 안에서 매번 부르던
// `N + K` 보다 항상 적다. **재로그인이 0건이면 이 상한은 그대로다** — 시도가 있었을 때만 그
// 결과를 알리는 push 가 한 번 더 붙는다(로그인 자체가 내는 change 는 별개로 흐른다).
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
  const first = definition.methods[0]
  return first !== undefined && AUTO_RELOGIN_KINDS.has(first.kind)
}

export interface ResumeAuthDeps {
  auth: AuthRuntime
  // 필수 gate — 순차로 먼저 확인한다. `resuming` step 을 노출해 로그인 화면이 진행을 보인다.
  gateDefinitions: readonly AuthDefinition[]
  // 나머지 — gate 통과 뒤 한 번 병렬 확인한다.
  remainingDefinitions: readonly AuthDefinition[]
  // 마지막 full-state 방송.
  pushConnectionState: () => void
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
}

export function createAuthResume(deps: ResumeAuthDeps): AuthResumeHandle {
  const gateIds = new Set(deps.gateDefinitions.map((definition) => definition.id))
  let remainingResume: Promise<void> | null = null

  // probe 실패의 결과만 재로그인 대상이다. `expired` 가 아니면 그 사이 **사용자가 개입한 것**이다
  // — `none` 은 [연결 해제](끊은 연결을 되살리지 않는다), `valid` 는 사용자가 직접 시작한 로그인
  // (그 경우 `resume` 은 세대가 밀려 아무것도 바꾸지 않고 끝났다. 새 attempt 로 덮지 않는다).
  const demoted = (definition: AuthDefinition): boolean =>
    deps.auth.tryBind(definition.id)?.snapshot().status === 'expired'

  // 한 Auth 의 재로그인. 시도를 한 번이라도 했으면 true 를 돌려준다(마지막 방송 여부의 근거).
  const reloginOnce = async (definition: AuthDefinition): Promise<boolean> => {
    let attempted = false
    for (let attempt = 1; attempt <= MAX_RELOGIN_ATTEMPTS; attempt += 1) {
      // **매 시도 직전에 다시 읽는다** — 순차 루프라 시도와 시도 사이에 사용자 조작이 끼어든다.
      if (!demoted(definition)) return attempted
      attempted = true
      deps.logger?.('auth.resume.relogin.start', { authId: definition.id, attempt })
      // **로그인은 던질 수 있다.** `resume` 과 달리 `login` 에는 "부팅 경로라 던지지 않는다" 는
      // 계약이 없다 — 예를 들어 `BrowserSessionPort.acquire` 는 미등록 group 에 raw throw 하고
      // `SessionRunner.login` 은 그것을 try 밖에서 부른다. 여기는 `void run()` 으로 불리는
      // fire-and-forget 경로라, 흘려보내면 unhandled rejection 이 되고 **남은 후보의 재로그인과
      // 마지막 방송이 통째로 건너뛰어진다**. 그래서 사용자가 그만둔 것과 같은 취급으로 접는다.
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
        return attempted
      }
      deps.logger?.('auth.resume.relogin.result', {
        authId: definition.id,
        attempt,
        step: step.kind,
        ...ifPresent('reason', step.kind === 'failed' ? step.reason : undefined)
      })
      // 확인만 실패한 것이면 다시 해 볼 여지가 있다. 그 밖의 결말은 사용자를 기다리거나
      // (`input-required`·`code-required`) 사용자가 이미 그만둔 것이다(`cancelled`·`unsupported`).
      if (step.kind !== 'failed' || step.reason !== 'probe_failed') return attempted
    }
    return attempted
  }

  // 강등된 Auth 를 **순차로** 다시 로그인한다 — 창이 동시에 여러 개 뜨지 않게(헤더 참조).
  const reloginDemoted = async (candidates: readonly AuthDefinition[]): Promise<void> => {
    let attempted = false
    for (const definition of candidates) {
      if (!autoReloginable(definition)) continue
      if (await reloginOnce(definition)) attempted = true
    }
    // 시도가 없었으면 방송도 없다 — 재시도 0건인 부팅의 방송 횟수가 `1 + K` 로 유지된다.
    if (attempted) deps.pushConnectionState()
  }

  const resumeRemainingOnce = async (): Promise<void> => {
    const candidates = deps.remainingDefinitions.filter((definition) => {
      if (!definition.probe) return false
      const snapshot = deps.auth.tryBind(definition.id)?.snapshot()
      // 이미 확인된 것과 grant 가 없는 것은 물어볼 이유가 없다. `status !== 'valid'` 면 정책이
      // 요청 자체를 막으므로 물어볼 수도 없다.
      return snapshot?.status === 'valid' && !snapshot.verified
    })
    if (candidates.length === 0) return
    await Promise.all(
      candidates.map((definition) =>
        deps.auth.resume(definition.id, { exposeStep: false, emitVerifiedChange: false })
      )
    )
    // 성공한 probe 들의 상태는 **재로그인 전에** 화면에 도달한다 — 재시도는 로그인 창 타임아웃만큼
    // 길어질 수 있고, 그동안 살아 있는 연결까지 붙들려 있으면 안 된다.
    deps.pushConnectionState()
    await reloginDemoted(candidates)
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
    }
  }
}
