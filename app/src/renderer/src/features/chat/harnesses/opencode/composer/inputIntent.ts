import { useChatStore } from '../../../store/chatStore'
import { composerCatalogState } from './composerCatalogState'

export function openCodeInputIntent(): void {
  const store = useChatStore.getState()
  const entry = store.sessions[store.activeKey]
  if (!entry) return
  const { sessionId, cwd, projectId, pendingProjectId, providerKey, agentKind } = entry.session
  if (!sessionId && !cwd && !projectId && !pendingProjectId) return
  composerCatalogState(
    {
      backend: 'opencode',
      sessionId,
      cwd,
      projectId: projectId ?? pendingProjectId,
      providerKey,
      agentKind
    },
    entry.draftGeneration
  ).intent()
}
