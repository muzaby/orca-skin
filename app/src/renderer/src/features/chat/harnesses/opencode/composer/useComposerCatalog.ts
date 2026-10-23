import { useMemo, useSyncExternalStore } from 'react'
import { useChatSession } from '../../../store/chatStore'
import { composerCatalogState, type ComposerCatalogSnapshot } from './composerCatalogState'
import type { ComposerCatalogPart } from '../../../../../../../shared/composer-catalog'
import { composerAgentCache } from './composerAgentCache'

const pending: ComposerCatalogSnapshot = {
  agents: { status: 'loading' },
  models: { status: 'loading' }
}
const emptySubscribe = (): (() => void) => () => undefined

export function useComposerCatalog(
  providerKey: string | null,
  resources = false
): {
  snapshot: ComposerCatalogSnapshot
  retry(part: ComposerCatalogPart): void
} {
  const sessionId = useChatSession((state) => state.sessionId)
  const cwd = useChatSession((state) => state.cwd)
  const projectId = useChatSession((state) => state.projectId ?? state.pendingProjectId)
  const agentKind = useChatSession((state) => state.agentKind)
  const agents = useSyncExternalStore(composerAgentCache.subscribe, composerAgentCache.get)
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
        ? composerCatalogState({
            backend: 'opencode',
            sessionId,
            cwd,
            projectId,
            providerKey,
            agentKind
          })
        : undefined,
    [sessionId, cwd, projectId, providerKey, agentKind]
  )
  const snapshot = useSyncExternalStore(
    (resources ? state?.subscribeResources : state?.subscribe) ?? emptySubscribe,
    state?.getSnapshot ?? (() => unscoped),
    state?.getSnapshot ?? (() => unscoped)
  )
  return { snapshot, retry: (part) => state?.retry(part) }
}
