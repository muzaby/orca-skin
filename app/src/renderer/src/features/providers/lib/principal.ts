// 사이드바에 표시할 신원 선택 (0182).
//
// **왜 `.ts` 인가**: renderer vitest include 는 `src/**/*.test.ts` 라 `.tsx` 테스트는 수집되지
// 않는다(`vitest.config.ts`). 판정을 컴포넌트 안에 두면 기계 검증이 사라지므로, 0181 의
// `features/skills/lib/providerRows.ts` 와 같은 방식으로 순수부만 내린다.
//
// **왜 규칙이 필요한가**: 게이트는 **N개가 가능**하다 — 게이트 화면이 선언 순서대로 순차
// 진행하며 "n/N" 을 표시한다(`GateLogin`). 그래서 "게이트의 principal" 만으로는 누구를 보여줄지
// 정해지지 않는다.

import type { ProviderInfo } from '../../../../../shared/ipc'

// 선언 순서상 **principal 을 가진 첫 게이트**. 게이트가 0개거나 아무도 principal 이 없으면 null.
//
// 순서를 뒤집지 않는 이유: 선언 순서가 곧 로그인 순서이고, 사용자가 화면에서 처음 만난 신원이
// 앱의 신원이다. "가장 최근에 인증한 것" 같은 규칙은 시간 상태를 하나 더 만들 뿐 읽는 사람에게
// 예측 가능하지 않다.
//
// **만료돼도 계속 보여 준다** — grant 는 남고 status 만 `expired` 가 되므로 principal 도 남는다.
// 이건 의도다: "누가 재인증해야 하는가" 를 화면이 말해 줘야 한다.
export function selectGatePrincipal(providers: readonly ProviderInfo[]): string | null {
  for (const provider of providers) {
    if (provider.kind !== 'gate') continue
    if (provider.principal !== null && provider.principal.length > 0) return provider.principal
  }
  return null
}
