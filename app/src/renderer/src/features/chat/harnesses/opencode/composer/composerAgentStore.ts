import { createStore, type StoreApi } from 'zustand/vanilla'
import type {
  NativeComposerCatalog,
  OpenCodePluginsChanged
} from '../../../../../../../shared/native-resources'
import { sessionApi } from '../../../../../shared/api/ipc'

export interface ComposerAgentState {
  agents?: NativeComposerCatalog['agents']
  revision: number
  accept(value: NativeComposerCatalog['agents'], revision: number): void
  invalidate(revision: number): void
}

/** The data subscription outlives every Composer, including navigation to /plugins. */
export function createComposerAgentStore(
  subscribe: (handler: (event: OpenCodePluginsChanged) => void) => (() => void) | undefined
): StoreApi<ComposerAgentState> {
  const store = createStore<ComposerAgentState>((set, get) => ({
    revision: 0,
    accept(value, revision) {
      const current = get()
      if (revision !== current.revision || current.agents !== undefined) return
      set({ agents: value })
    },
    invalidate(revision) {
      if (revision <= get().revision) return
      set({ revision, agents: undefined })
    }
  }))
  subscribe(({ revision }) => store.getState().invalidate(revision))
  return store
}

export const composerAgentStore = createComposerAgentStore(sessionApi.onOpenCodePluginsChanged)
