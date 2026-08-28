// 폐쇄망 spawn env 주입점 (0207).
//
// 배포가 이 상수를 채우면 **모든** Harness+ModelProvider 의 subprocess env 에 그 반환값이
// 실린다. 조립 규칙은 배포가 갖지 않는다 — 값 계산만 여기 있고, 순서·hoist·fingerprint 는
// 계속 `adapters/harness-config.ts` 가 소유한다.
//
// ── 채우는 법 ────────────────────────────────────────────────────────────────
// 완전한 예제는 `docs/guides/closed-network-extensions.md` §3-d 다 (0190 — 소스와 가이드에 같은
// 레시피를 두면 갈린다. 실제로 갈렸다). 여기 남기는 것은 예제를 읽기 전에 알아야 하는 계약뿐이다:
//
//   · **하네스에 전달되기 직전 최상위 레이어다** — augmenter·settings·app·process 를 전부 덮는다.
//     그래서 동적 credential 은 여기 넣지 않는다. 그것은 `harness-runtime.ts` 의 augmenter 몫이고,
//     여기 넣으면 config API 가 방금 받아온 token 을 하드코딩이 덮는다.
//   · 대상 좁히기는 **함수 안에서** `target` 으로 한다 — 등록 자체는 모든 key 에 걸린다.
//   · `target.resolved` 가 `false` 면 이번 턴은 entry 를 못 골랐다는 뜻이다. 그때도 불린다 —
//     사내 프록시·인증서가 빠진 채 spawn 하면 증상이 원인에서 멀어지기 때문이다.
//   · **값이 없으면 그 키를 빼고 빈 객체를 돌려준다. 던지지 마라** — 던지면 그 턴이 실패한다.

import type { SpawnEnvInjector } from '../../adapters/harness-config'

// 기본 배포는 주입점을 비워 둔다. `undefined` 는 오류가 아니라 정상 구성이며, 미등록 턴의
// 조립 결과·참조·성능은 0207 이전과 같다 — 정적 배포는 `options.env` 자체를 만들지 않는다.
export const SPAWN_ENV_INJECTOR: SpawnEnvInjector | undefined = undefined
