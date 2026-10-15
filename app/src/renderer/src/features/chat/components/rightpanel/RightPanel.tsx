import { assistantRuntime } from '../../harnesses/registries/assistant'
import { TranscriptRuntimeProvider } from '../../harnesses/common/transcript/TranscriptRuntime'
import { useMemo } from 'react'
import { useChatSession, useChatStore } from '../../store/chatStore'
import { harnessRightPanel } from '../../harnesses/registries/rightpanel'
import { rightPanelPolicy } from '../../lib/rightPanelTiles'
import { deriveRightPanelLayout, rightPanelColumnsForAgent } from '../../lib/rightPanelLayout'

export interface RightPanelProps {
  className?: string
  onExpandedChange?: (sessionKey: string, expanded: boolean) => void
}
export function RightPanel(props: RightPanelProps): React.JSX.Element | null {
  const backend = useChatSession((state) => state.backend)
  const kind = useChatSession((state) => state.agentKind)
  const tiles = useChatSession((state) => state.rightPanelTiles)
  const key = useChatStore((state) => state.activeKey)
  const module = harnessRightPanel(backend)
  const Panel = module.Panel
  const layout = useMemo(
    () => deriveRightPanelLayout(rightPanelColumnsForAgent(tiles, kind, backend)),
    [tiles, kind, backend]
  )
  return (
    <TranscriptRuntimeProvider value={assistantRuntime(backend)}>
      <Panel
        key={module.resetBySession ? key : undefined}
        {...props}
        configuration={module.configuration}
        panelPolicy={rightPanelPolicy(kind, backend)}
        layout={layout}
      />
    </TranscriptRuntimeProvider>
  )
}
