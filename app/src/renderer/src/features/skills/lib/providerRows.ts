// 카탈로그 provider 탭의 순수 판정 (0181). renderer 의 `.tsx` 는 vitest include
// (`src/**/*.test.ts`) 밖이라 기계 검증이 안 되므로, 표에서 판정 가능한 로직만 여기로 내린다.
//
// 구 `pluginCatalog.ts`·`connectorActions.ts` 두 벌이 하던 일을 하나로 접었다 — 앱 로그인과
// 서비스 연결이 같은 DTO(`ProviderInfo`)를 쓰기 때문에 행 판정도 한 벌이면 된다.

import type {
  ProviderAuthKind,
  ProviderAuthSpecInfo,
  ProviderGrantStatus,
  ProviderInfo,
  ProviderKind
} from '../../../../../shared/ipc'
import type { MessageKey } from '../../../shared/i18n'

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

// **선언 순서를 그대로 낸다.** 배포 선언이 먼저 적은 방식이 GUI 의 첫 선택지다 — 정렬하거나
// 재배열하면 배포가 의도한 권장 순서가 사라진다.
export function authChoices(provider: ProviderInfo): ProviderAuthSpecInfo[] {
  return [...provider.auth]
}

// 선언이 하나뿐이면 고를 것이 없다 — 선택 단계를 건너뛴다(K1 완화책). 폐쇄망 배포의 게이트는
// 대개 1종이라 실제 사용자는 선택 화면을 보지 않는다.
export function needsAuthChoice(provider: ProviderInfo): boolean {
  return provider.auth.length > 1
}

// 화면이 처음 고르는 방식: 이미 인증돼 있으면 그 방식(재인증의 기본값), 아니면 선언 첫 항목.
export function initialAuthKind(provider: ProviderInfo): ProviderAuthKind | null {
  if (provider.activeAuthKind) return provider.activeAuthKind
  return provider.auth[0]?.kind ?? null
}

// 재인증은 이력이 있을 때만 의미가 있다. 없으면 버튼은 "연결" 하나다.
export function canReauth(provider: ProviderInfo): boolean {
  return provider.status !== 'none'
}

export function canRevoke(provider: ProviderInfo): boolean {
  return provider.status !== 'none'
}
