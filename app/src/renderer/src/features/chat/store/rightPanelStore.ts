import { create } from 'zustand'
import type { AgentKind } from '../../../../../shared/agent-kind'
import {
  initialLayer,
  layerKey,
  navigateStack,
  type PanelEntry,
  type PanelSession
} from '../lib/rightPanelStack'
import { rightPanelTarget, type RightPanelTileId } from '../lib/panelTiles'

interface PanelState {
  session: PanelSession
  stack: PanelEntry[]
  memory: Partial<Record<AgentKind, RightPanelTileId>>
  direction: 'forward' | 'back' | 'session'
  fallbackFocus?: HTMLElement
  returnFocus?: HTMLElement
}

export const useRightPanelStore = create<PanelState>(() => ({
  session: { key: '', kind: 'code', backend: null },
  stack: [],
  memory: {},
  direction: 'session'
}))

let writeOpen: ((open: boolean) => void) | undefined

export function connectPanelSettings(write: (open: boolean) => void): () => void {
  writeOpen = write
  return () => {
    if (writeOpen === write) writeOpen = undefined
  }
}

function commit(
  stack: PanelEntry[],
  direction: PanelState['direction'],
  returnFocus?: HTMLElement,
  fallbackFocus?: HTMLElement
): void {
  const previous = useRightPanelStore.getState()
  const top = stack.at(-1)
  const memory =
    top?.kind === 'tile' ? { ...previous.memory, [previous.session.kind]: top.id } : previous.memory
  useRightPanelStore.setState({ stack, memory, direction, returnFocus, fallbackFocus })
  if (!!previous.stack.length !== !!stack.length) writeOpen?.(!!stack.length)
}

export const panelActions = {
  switchSession(session: PanelSession, open: boolean): void {
    const state = useRightPanelStore.getState()
    const changed =
      state.session.key !== session.key ||
      state.session.kind !== session.kind ||
      state.session.backend !== session.backend
    if (!changed && !!state.stack.length === open) return
    useRightPanelStore.setState({
      session,
      stack: open ? [initialLayer(session, state.memory[session.kind])] : [],
      direction: 'session',
      returnFocus: undefined,
      fallbackFocus: undefined
    })
  },
  navigate(entry: PanelEntry, toggle = false): void {
    const { session, memory, stack } = useRightPanelStore.getState()
    const next = navigateStack(stack, entry, initialLayer(session, memory[session.kind]), toggle)
    if (entry.kind === 'tile' && !next.length) {
      // Closing with the title-bar toggle retains the last viewed tile.
      return commit([], 'back', stack.at(-1)?.origin)
    }
    if (next === stack && (entry.kind !== 'tile' || memory[session.kind] === entry.id)) return
    commit(next, next.length < stack.length ? 'back' : 'forward')
  },
  tile(id: RightPanelTileId, toggle = false, origin?: HTMLElement): void {
    const { session } = useRightPanelStore.getState()
    const target = rightPanelTarget(id, session.kind, session.backend)
    if (target) panelActions.navigate({ kind: 'tile', id: target, origin }, toggle)
  },
  back(): void {
    const { stack } = useRightPanelStore.getState()
    if (stack.length > 1)
      commit(stack.slice(0, -1), 'back', stack.at(-1)?.origin, stack.at(-1)?.fallbackOrigin)
  },
  close(): void {
    const { stack } = useRightPanelStore.getState()
    if (stack.length) commit([], 'back', stack[0].origin)
  },
  updateDetail(entry: PanelEntry): void {
    const { stack } = useRightPanelStore.getState()
    const top = stack.at(-1)
    if (top && layerKey(top) === layerKey(entry))
      useRightPanelStore.setState({
        stack: [
          ...stack.slice(0, -1),
          { ...entry, origin: top.origin, fallbackOrigin: top.fallbackOrigin }
        ]
      })
  }
}

export function useTopPanelTile(): RightPanelTileId | null {
  return useRightPanelStore((state) => {
    const top = state.stack.at(-1)
    return top?.kind === 'tile' ? top.id : null
  })
}
