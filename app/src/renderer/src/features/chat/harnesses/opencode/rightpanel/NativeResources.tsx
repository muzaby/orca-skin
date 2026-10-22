import {
  NativeResourcesTileContent,
  NativeResourcesTileView
} from '../../../components/rightpanel/NativeResourcesTile'
import { useNativeResources } from '../../../hooks/useNativeResources'
import { useChatSession } from '../../../store/chatStore'
import { useComposerCatalog } from '../composer/useComposerCatalog'
import { preparedResourcesView } from './preparedResourcesView'

export function OpenCodeNativeResourcesTile(): React.JSX.Element {
  const sessionId = useChatSession((state) => state.sessionId)
  return sessionId ? <NativeResourcesTileContent /> : <OpenCodeDraftResources />
}

function OpenCodeDraftResources(): React.JSX.Element {
  const cwd = useChatSession((state) => state.cwd)
  const projectId = useChatSession((state) => state.projectId ?? state.pendingProjectId)
  const providerKey = useChatSession((state) => state.providerKey)
  const configured = useNativeResources(null, true, 'opencode', {
    backend: 'opencode',
    cwd,
    projectId
  })
  const catalog = useComposerCatalog(providerKey, true)
  return (
    <NativeResourcesTileView
      refreshable
      resources={{
        ...configured,
        view: preparedResourcesView(catalog.snapshot, configured.view),
        refresh: () => {
          configured.refresh()
          catalog.retry('mcp')
          catalog.retry('plugins')
        }
      }}
    />
  )
}
