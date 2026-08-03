import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'

export type CatalogTab = 'skills' | 'mcp' | 'plugins'
export interface CatalogSelection {
  tab: CatalogTab
  selectedId: string | null
}

export const CATALOG_TABS = [
  { tab: 'skills', icon: 'doc', labelKey: 'skills.rail.skills' },
  { tab: 'mcp', icon: 'link', labelKey: 'skills.rail.mcp' },
  { tab: 'plugins', icon: 'layers', labelKey: 'skills.rail.plugins' }
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
