// 사용량 리포트 매핑 계약 (0099 → 0176 → **0183 축소**).
//
// ── 0183 이 무엇을 지웠나 ────────────────────────────────────────────────────
// 구 구조는 `StaticUsageProviderModule` 이 축이었고 해소 경로가 셋(`config`·`provider`·
// `subscription`)이었다. 그중 앞의 둘은 모듈이 **자기 손으로 요청을 만드는** 설계(`ctx.fetch` +
// `ctx.secret`)인데, 0157 이후 `provider:<key>:` 네임스페이스에 **쓰는 코드가 0곳**이라 인증이
// 필요한 endpoint 에는 도달할 수 없었다 — 공개 endpoint 전용으로 두 경로가 남아 있었고 활성
// 모듈은 0개였다.
//
// 이제 축은 **`Provider.usage` 선언 하나**다(`contracts/provider.ts`). 선언한 provider 가 곧
// 호출 대상이라 `sourceId` 조인이 사라지고, 배포가 고치는 파일도 `declarations/` 하나로 모인다.
//
// 여기 남는 것은 **표본 → 리포트 매핑의 컨텍스트**뿐이다.

import type { UsageSample } from './usage-source'

// `map` 이 받는 컨텍스트. **`fetch` 도 `secret` 도 없다** — 매핑 함수는 raw credential 을 보지
// 않는다(AUTH-PLAT-009 를 usage 경로까지 확장한 0176 결정. 0183 에서도 유지).
export interface UsageMapContext {
  providerKey: string
  store: { get(key: string): unknown; set(key: string, value: unknown): void }
  logger: (message: string, meta?: Record<string, unknown>) => void
  clock: () => number
}

export type { UsageSample }
