import { memo } from 'react'
import { ClaudeToolGroup } from '../../harnesses/claude/transcript/ToolGroup'
import { OpenCodeToolGroup } from '../../harnesses/opencode/transcript/ToolGroup'
import type { ToolCall } from '../../reducer/chatReducer'
import type { AgentTranscriptPresentation } from '../../lib/agentPresentation'

export const ToolGroup = memo(function ToolGroup(props: {
  calls: ToolCall[]
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element | null {
  return props.transcriptPolicy.surface === 'opencode' ? (
    <OpenCodeToolGroup {...props} />
  ) : (
    <ClaudeToolGroup {...props} />
  )
})
