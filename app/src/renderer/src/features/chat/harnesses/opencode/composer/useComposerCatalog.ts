import { useMemo, useSyncExternalStore } from 'react'
import { useStore } from 'zustand'
import { useChatSession, useChatStore } from '../../../store/chatStore'
import { composerCatalogState, type ComposerCatalogSnapshot } from './composerCatalogState'
import type { ComposerCatalogPart } from '../../../../../../../shared/composer-catalog'
import { composerAgentStore } from './composerAgentStore'

const pending: ComposerCatalogSnapshot = {
  agents: { status: 'loading' },
  models: { status: 'loading' }
}
const emptySubscribe = (): (() => void) => () => undefined

export function useComposerCatalog(providerKey: string | null): {
  snapshot: ComposerCatalogSnapshot
  retry(part: ComposerCatalogPart): void
} {
  const sessionId = useChatSession((state) => state.sessionId)
  const identity = useChatStore((state) => state.sessions[state.activeKey]?.draftGeneration)
  const cwd = useChatSession((state) => state.cwd)
  const projectId = useChatSession((state) => state.projectId ?? state.pendingProjectId)
  const agentKind = useChatSession((state) => state.agentKind)
  const agents = useStore(composerAgentStore, (state) => state.agents)
  const unscoped = useMemo<ComposerCatalogSnapshot>(
    () => ({
      ...pending,
      agents: agents === undefined ? pending.agents : { status: 'ready', value: agents }
    }),
    [agents]
  )
  const state = useMemo(
    () =>
      sessionId || cwd || projectId
        ? composerCatalogState(
            {
              backend: 'opencode',
              sessionId,
              cwd,
              projectId,
              providerKey,
              agentKind
            },
            identity
          )
        : undefined,
    [sessionId, cwd, projectId, providerKey, agentKind, identity]
  )
  const snapshot = useSyncExternalStore(
    state?.subscribe ?? emptySubscribe,
    state?.getSnapshot ?? (() => unscoped),
    state?.getSnapshot ?? (() => unscoped)
  )
  return { snapshot, retry: (part) => state?.retry(part) }
}
