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
  request: number
  expanded: boolean
  width: number
}

export const initialOpenCodeDetailState: OpenCodeDetailState = {
  selection: null,
  request: 0,
  expanded: false,
  width: 560
}

export type OpenCodeDetailAction =
  | { type: 'open'; selection: OpenCodePanelSelection; origin?: HTMLElement }
  | { type: 'select'; selection: OpenCodePanelSelection }
  | { type: 'close' }
  | { type: 'expand' }
  | { type: 'resize'; width: number }

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
        request: state.request + 1,
        expanded: false
      }
    case 'select':
      return state.selection?.id === action.selection.id
        ? { ...state, selection: action.selection }
        : state
    case 'close':
      return state.selection
        ? { ...state, selection: null, origin: undefined, expanded: false }
        : state
    case 'expand':
      return state.selection ? { ...state, expanded: !state.expanded } : state
    case 'resize':
      return { ...state, width: action.width }
  }
}
