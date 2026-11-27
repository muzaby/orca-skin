import { createContext, useContext } from 'react'
import type { PanelEntry } from '../../../lib/rightPanelStack'

export interface PanelNavigation {
  layer: PanelEntry
  active: boolean
  canGoBack: boolean
  back: () => void
  close: () => void
}

export const PanelNavigationContext = createContext<PanelNavigation | null>(null)
export function useRightPanelNav(): PanelNavigation | null {
  return useContext(PanelNavigationContext)
}
