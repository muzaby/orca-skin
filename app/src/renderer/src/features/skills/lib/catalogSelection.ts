import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'

// plugins 탭은 wire 호환 이름인 providers.list 전체를 계속 보여 준다. gate·harness·usage의
// 로그인 도달성을 보존하면서 사용자 대면 탭 이름만 Plugin 중심으로 정리한다.
export type CatalogTab = 'plugins' | 'skills' | 'mcp'
export interface CatalogSelection {
  tab: CatalogTab
  selectedId: string | null
}

export const CATALOG_TABS = [
  { tab: 'plugins', icon: 'electricalServices', labelKey: 'skills.rail.plugins' },
  { tab: 'skills', icon: 'doc', labelKey: 'skills.rail.skills' },
  { tab: 'mcp', icon: 'link', labelKey: 'skills.rail.mcp' }
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
