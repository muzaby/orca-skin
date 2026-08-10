import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'

// 0181 — 구 `plugins` 탭 자리에 `providers` 가 들어온다(사용자 결정: 새 페이지가 아니라 이
// 카탈로그를 유지). 앱 로그인·모델 자격증명·사내 서비스 연결이 **한 탭**이다 — 셋의 차이는
// `ProviderInfo.kind` 뿐이라 화면을 나눌 이유가 없다.
export type CatalogTab = 'skills' | 'mcp' | 'providers'
export interface CatalogSelection {
  tab: CatalogTab
  selectedId: string | null
}

export const CATALOG_TABS = [
  { tab: 'skills', icon: 'doc', labelKey: 'skills.rail.skills' },
  { tab: 'mcp', icon: 'link', labelKey: 'skills.rail.mcp' },
  { tab: 'providers', icon: 'power', labelKey: 'skills.rail.providers' }
] as const satisfies readonly { tab: CatalogTab; icon: IconName; labelKey: MessageKey }[]

export const selectTab = (_state: CatalogSelection, tab: CatalogTab): CatalogSelection => ({
  tab,
  selectedId: null
})
export const openDetail = (state: CatalogSelection, selectedId: string): CatalogSelection => ({
  ...state,
  selectedId
})
export const back = (state: CatalogSelection): CatalogSelection => ({ ...state, selectedId: null })
