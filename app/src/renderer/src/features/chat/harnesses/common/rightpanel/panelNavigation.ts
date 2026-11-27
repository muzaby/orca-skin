import { createContext, useContext, useEffect, useRef } from 'react'
import type { PanelDetailSelection, PanelEntry } from '../../../lib/rightPanelStack'

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

export function useSubagentDetail(): Extract<PanelDetailSelection, { id: 'subagent' }> | undefined {
  const nav = useRightPanelNav()
  const layer = nav?.layer
  return layer?.kind === 'detail' && layer.selection.id === 'subagent' ? layer.selection : undefined
}

// An item can be outside the initial page while its keyed detail is loading.
// Pop only after the item was present on this layer and then disappeared.
export function useDismissMissingSubagent(exists: boolean): void {
  const nav = useRightPanelNav()
  const layer = nav?.layer
  const selection =
    layer?.kind === 'detail' && layer.selection.id === 'subagent' ? layer.selection : undefined
  const seen = useRef<typeof selection>(undefined)
  useEffect(() => {
    if (selection?.selectedId && exists) seen.current = selection
    else if (nav?.active && selection && seen.current === selection) {
      seen.current = undefined
      nav.back()
    }
  }, [nav, selection, exists])
}
