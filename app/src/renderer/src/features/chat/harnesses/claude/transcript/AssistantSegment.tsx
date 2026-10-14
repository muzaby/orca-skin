import { memo } from 'react'
import { Markdown } from '../../../../../shared/ui/markdown/Markdown'
import { ClaudeToolGroup as ToolGroup } from './ToolGroup'
import { ReasoningBlock } from './ReasoningBlock'
import { ErrorCard } from './ErrorCard'
import { StructuredOutputCard } from './StructuredOutputCard'
import { WorkToolTimeline } from '../../../components/transcript/WorkToolTimeline'
import { AskExchange } from '../../../components/transcript/AskExchange'
import { CompactBoundaryMarker } from '../../../components/transcript/CompactBoundaryMarker'
import { ForkBoundaryMarker } from '../../../components/transcript/ForkBoundaryMarker'
import { SubagentNoticeRow } from '../../../components/transcript/SubagentNoticeRow'
import type { MessageSegment } from '../../../lib/parts'
import type { AgentTranscriptPresentation } from '../../../lib/agentPresentation'
// Work의 도구 행만 전용 표현을 사용한다. 질문·오류·서브에이전트 계약은 함께 유지한다.
export const ClaudeAssistantSegment = memo(function ClaudeAssistantSegment({
  segment: seg,
  transcriptPolicy
}: {
  segment: MessageSegment
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element {
  switch (seg.kind) {
    case 'reasoning':
      return <ReasoningBlock items={seg.items} />
    case 'tools':
      return transcriptPolicy.turnProjection === 'work-activity' ? (
        <WorkToolTimeline calls={seg.calls} transcriptPolicy={transcriptPolicy} />
      ) : (
        <ToolGroup calls={seg.calls} transcriptPolicy={transcriptPolicy} />
      )
    case 'ask':
      return <AskExchange call={seg.call} />
    case 'structured':
      return <StructuredOutputCard value={seg.value} />
    case 'text':
      return <Markdown source={seg.text} />
    case 'error':
      return <ErrorCard error={seg.error} />
    case 'compact':
      return (
        <CompactBoundaryMarker
          trigger={seg.trigger}
          preTokens={seg.preTokens}
          postTokens={seg.postTokens}
        />
      )
    case 'fork':
      return <ForkBoundaryMarker />
    case 'subagent_notice':
      return (
        <SubagentNoticeRow
          toolRunId={seg.toolRunId}
          status={seg.status}
          durationMs={seg.durationMs}
          summary={seg.summary}
          transcriptPolicy={transcriptPolicy}
        />
      )
  }
})
