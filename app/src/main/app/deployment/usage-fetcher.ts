// 원격 사용량 배선 (0188 — 0186 의 `UsageFetcher` 경계 유지).
//
// `features/usage` 는 endpoint 도 응답 형태도 모른다. 여기서 `BoundAuth.request` 로 만든
// concrete 를 컴포지션 루트가 주입한다. **선언 슬롯을 만들지 않는다** (0183 r2 유지).
//
// ── `supports()` 는 Auth 상태가 아니다 ────────────────────────────────────────
// 이 배포가 그 key 의 **원격 사용량을 지원하는가** 만 말한다. 미인증·만료 상태에서
// `supports:false` 로 숨기면 사용자는 "사용량 기능이 없는 앱" 을 보게 된다 — 실제로는
// 재인증하면 되는 상태다. 그래서 `supports` 는 그대로 두고 `fetchUsage()` 가 Auth 오류를
// 정상적으로 전파하게 한다.
//
// ── `baselineUsable` 은 fail-closed ─────────────────────────────────────────
// `asOf` 가 **billing aggregation watermark** 임을 배포가 확인한 경우에만 `true` 다. 단순
// 응답 생성 시각이면 `false` 로 둔다 — 그러지 않으면 원격이 이미 센 턴의 로컬 행이
// `created_at > asOf` 가 되어 같은 턴이 두 번 더해진다.
//
// ── 채우는 예 ────────────────────────────────────────────────────────────────
//
// ```ts
// import { CLAUDE_CORP_KEY } from './harness-runtime'
//
// export function createCorpUsageFetcher(auth: BoundAuth): UsageFetcher {
//   return {
//     supports: (key) => key === CLAUDE_CORP_KEY,
//     async fetchUsage(key, signal) {
//       const response = await auth.request({ path: '/api/usage' }, signal)
//       if (!response.ok) throw new Error(`usage request failed: ${response.status}`)
//       return mapCorpUsageSnapshot(key, response.body)
//     }
//   }
// }
// ```
//
// Auth 는 `/api/usage` 와 `UsageSnapshot` 을 모른다. Harness 모듈도 Usage endpoint 를 모른다.
// Scheduler 는 기존처럼 `UsageFetcher` 를 호출할 뿐이다.

import type { AuthRuntime } from '../../contracts/auth'
import type { UsageFetcher } from '../../features/usage/fetcher'

export interface UsageDeploymentDeps {
  auth: AuthRuntime
}

// **`undefined` 는 오류가 아니라 정상 구성이다** — 원격 사용량 endpoint 가 없는 배포에서는
// 주입하지 않고, 그러면 관련 cron 잡도 등록되지 않는다.
export function createUsageFetcher(deps: UsageDeploymentDeps): UsageFetcher | undefined {
  void deps
  return undefined
}
