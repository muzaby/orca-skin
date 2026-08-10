// `ProviderInfo` 위의 순수 판정 (0181). **shared 에 있는 이유**: 게이트 화면
// (`features/providers`)과 카탈로그 연결 탭(`features/skills`)이 **같은 규칙**을 써야 하는데,
// feature 끼리는 교차 import 가 금지돼 있다. 규칙 자체가 특정 feature 의 것이 아니라 공유 DTO
// (`ProviderInfo`)의 것이므로 여기가 제자리다 — 두 벌로 두면 한쪽만 고쳐져 갈린다.

import type { ProviderAuthKind, ProviderAuthSpecInfo, ProviderInfo } from '../../../../shared/ipc'

// **선언 순서를 그대로 낸다.** 배포 선언이 먼저 적은 방식이 GUI 의 첫 선택지다 — 정렬하거나
// 재배열하면 배포가 의도한 권장 순서가 사라진다.
export function authChoices(provider: ProviderInfo): ProviderAuthSpecInfo[] {
  return [...provider.auth]
}

// 선언이 하나뿐이면 고를 것이 없다 — 선택 단계를 건너뛴다. 폐쇄망 배포의 게이트는 대개 1종이라
// 실제 사용자는 선택 화면을 보지 않는다.
export function needsAuthChoice(provider: ProviderInfo): boolean {
  return provider.auth.length > 1
}

// 화면이 처음 고르는 방식: 이미 인증돼 있으면 그 방식(재인증의 기본값), 아니면 선언 첫 항목.
export function initialAuthKind(provider: ProviderInfo): ProviderAuthKind | null {
  if (provider.activeAuthKind) return provider.activeAuthKind
  return provider.auth[0]?.kind ?? null
}
