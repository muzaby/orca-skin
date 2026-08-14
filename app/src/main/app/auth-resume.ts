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
// `N + K` 보다 항상 적다.
//
// 이 모듈은 **electron 을 물지 않는다** — bootstrap 인라인이면 순서와 방송 횟수를 사람 실기로만
// 확인할 수 있다.

import type { AuthDefinition, AuthId, AuthRuntime } from '../contracts/auth'

export interface ResumeAuthDeps {
  auth: AuthRuntime
  // 필수 gate — 순차로 먼저 확인한다. `resuming` step 을 노출해 로그인 화면이 진행을 보인다.
  gateDefinitions: readonly AuthDefinition[]
  // 나머지 — gate 통과 뒤 한 번 병렬 확인한다.
  remainingDefinitions: readonly AuthDefinition[]
  // 마지막 full-state 방송.
  pushConnectionState: () => void
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
    deps.pushConnectionState()
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
