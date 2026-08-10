// 카탈로그 provider 탭의 순수 판정 (0181). renderer 의 `.tsx` 는 vitest include
// (`src/**/*.test.ts`) 밖이라 기계 검증이 안 되므로, 표에서 판정 가능한 로직만 여기로 내린다.
//
// 구 `pluginCatalog.ts`·`connectorActions.ts` 두 벌이 하던 일을 하나로 접었다 — 앱 로그인과
// 서비스 연결이 같은 DTO(`ProviderInfo`)를 쓰기 때문에 행 판정도 한 벌이면 된다.

import type { ProviderGrantStatus, ProviderInfo, ProviderKind } from '../../../../../shared/ipc'
import type { MessageKey } from '../../../shared/i18n'

// 방식 선택 규칙은 게이트 화면(`features/providers`)과 **같은 구현**을 써야 한다 — feature 끼리는
// 교차 import 가 금지돼 있어 공유 DTO 의 규칙은 shared 가 갖는다. 여기서는 재노출만 한다
// (기존 import 경로·테스트 무회귀).
export { authChoices, initialAuthKind, needsAuthChoice } from '../../../shared/config/providerAuth'

export interface ProviderRowMeta {
  statusKey: MessageKey
  // 지금 무엇으로 연결돼 있는가. 미인증이면 null — 화면이 "무엇으로 연결됐는지" 를 보여준다.
  activeLabel: string | null
  kindKey: MessageKey
}

const STATUS_KEYS: Record<ProviderGrantStatus, MessageKey> = {
  none: 'skills.provider.status.none',
  valid: 'skills.provider.status.valid',
  expired: 'skills.provider.status.expired',
  unknown: 'skills.provider.status.unknown'
}

const KIND_KEYS: Record<ProviderKind, MessageKey> = {
  gate: 'skills.provider.kind.gate',
  llm: 'skills.provider.kind.llm',
  service: 'skills.provider.kind.service'
}

export function providerRowMeta(provider: ProviderInfo): ProviderRowMeta {
  const active = provider.auth.find((spec) => spec.kind === provider.activeAuthKind)
  return {
    statusKey: STATUS_KEYS[provider.status],
    activeLabel: active?.label ?? null,
    kindKey: KIND_KEYS[provider.kind]
  }
}

// 재인증은 이력이 있을 때만 의미가 있다. 없으면 버튼은 "연결" 하나다.
export function canReauth(provider: ProviderInfo): boolean {
  return provider.status !== 'none'
}

export function canRevoke(provider: ProviderInfo): boolean {
  return provider.status !== 'none'
}
