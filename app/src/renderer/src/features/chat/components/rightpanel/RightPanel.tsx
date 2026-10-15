import { useChatSession, useChatStore } from '../../store/chatStore'
import { ClaudeRightPanel } from '../../harnesses/claude/rightpanel/Panel'
import { OpenCodeRightPanel } from '../../harnesses/opencode/rightpanel/Panel'

export interface RightPanelProps {
  className?: string
  onExpandedChange?: (sessionKey: string, expanded: boolean) => void
}
export function RightPanel(props: RightPanelProps): React.JSX.Element | null {
  const backend = useChatSession((state) => state.backend)
  const key = useChatStore((state) => state.activeKey)
  return backend === 'opencode' ? (
    <OpenCodeRightPanel key={key} {...props} />
  ) : (
    <ClaudeRightPanel {...props} />
  )
}
