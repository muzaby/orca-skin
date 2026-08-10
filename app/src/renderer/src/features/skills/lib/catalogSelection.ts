import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'

// 0180 에서 `plugins` 탭이 사라졌다 — 인증·커넥터 스택 제거. 0181 이 provider 목록으로
// 다시 세운다(사용자 결정: 새 페이지가 아니라 이 카탈로그를 유지).
export type CatalogTab = 'skills' | 'mcp'
export interface CatalogSelection {
  tab: CatalogTab
  selectedId: string | null
}

export const CATALOG_TABS = [
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
