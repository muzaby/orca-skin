// 필수 gate membership (0188).
//
// **Auth 는 자신이 gate 에 쓰이는지 모른다** (D-007). 그 지식은 여기 하나에 있다 — 배포가
// `auth-definitions.ts` 의 상수를 **객체 참조로** 골라 담는다. AuthId 문자열을 다시 적지
// 않는 이유는 오타가 "게이트가 조용히 사라지는" 형태로 나타나기 때문이다.
//
// 타입이 `GateAuthDefinition` 인 것이 강제의 절반이다 — `probe` 없는 정의는 여기 담기지
// 않는다(compile time). 나머지 절반은 부팅 composition 의 runtime fail-closed 다
// (`app/bootstrap.ts` 의 `gateAuthDefinitions()`).

import type { AuthDefinition, GateAuthDefinition } from '../../contracts/auth'

export const GATE_AUTH_DEFINITIONS: readonly GateAuthDefinition[] = []

// gate 가 아닌 나머지 — 부팅에서 gate 통과 뒤 **한 번** 병렬 resume 하는 대상이다.
export function remainingAuthDefinitions(
  all: readonly AuthDefinition[],
  gates: readonly GateAuthDefinition[]
): readonly AuthDefinition[] {
  const gateIds = new Set(gates.map((gate) => gate.id))
  return all.filter((definition) => !gateIds.has(definition.id))
}
