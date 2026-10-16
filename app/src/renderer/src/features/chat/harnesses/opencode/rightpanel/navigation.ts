import { createContext, useContext } from 'react'

export type OpenCodePanelSelection =
  { id: 'diff' | 'source' } | { id: 'subagent' | 'process'; selectedId: string | null }

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

export interface OpenCodeDetailState {
  selection: OpenCodePanelSelection | null
  origin?: HTMLElement
  fallbackOrigin?: HTMLElement
  request: number
  expanded: boolean
}

export const initialOpenCodeDetailState: OpenCodeDetailState = {
  selection: null,
  request: 0,
  expanded: false
}

export type OpenCodeDetailAction =
  | {
      type: 'open'
      selection: OpenCodePanelSelection
      origin?: HTMLElement
      fallbackOrigin?: HTMLElement
    }
  | { type: 'select'; selection: OpenCodePanelSelection }
  | { type: 'close' }
  | { type: 'expand' }

export function openCodeDetailReducer(
  state: OpenCodeDetailState,
  action: OpenCodeDetailAction
): OpenCodeDetailState {
  switch (action.type) {
    case 'open':
      return {
        ...state,
        selection: action.selection,
        origin: action.origin,
        fallbackOrigin: action.fallbackOrigin,
        request: state.request + 1,
        expanded: false
      }
    case 'select':
      return state.selection?.id === action.selection.id
        ? { ...state, selection: action.selection }
        : state
    case 'close':
      return state.selection
        ? {
            ...state,
            selection: null,
            origin: undefined,
            fallbackOrigin: undefined,
            expanded: false
          }
        : state
    case 'expand':
      return state.selection ? { ...state, expanded: !state.expanded } : state
  }
}

export function openCodePanelFallbackOrigin(origin?: HTMLElement): HTMLElement | undefined {
  return (
    origin
      ?.closest('[data-component="opencode-session-panel"]')
      ?.querySelector<HTMLElement>('[data-panel-focus="changes"]') ?? undefined
  )
}
