import { createContext, useContext } from 'react'

import type { PanelDetailSelection } from '../../../lib/rightPanelStack'
export type OpenCodePanelSelection = PanelDetailSelection

export interface OpenCodePanelNavigation {
  open: (selection: OpenCodePanelSelection, origin?: HTMLElement) => void
  // Only the upper panel receives a selection. Mounted base tiles retain ChatState selection.
  selection?: OpenCodePanelSelection
  select?: (selection: OpenCodePanelSelection) => void
}

export const OpenCodePanelNavigationContext = createContext<OpenCodePanelNavigation | null>(null)

export function useOpenCodePanelNavigation(): OpenCodePanelNavigation | null {
  return useContext(OpenCodePanelNavigationContext)
}

export function openCodePanelFallbackOrigin(origin?: HTMLElement): HTMLElement | undefined {
  return (
    origin
      ?.closest('[data-component="opencode-session-panel"]')
      ?.querySelector<HTMLElement>('[data-panel-focus="changes"]') ?? undefined
  )
}
