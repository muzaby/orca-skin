import { memo } from 'react'
import type { MarkdownSourcePart } from '../../../../../shared/ui/markdown/sourceParts'
import { TranscriptMarkdown } from '../../../components/markdown/MarkdownDocument'
import { ClaudeToolGroup as ToolGroup } from './ToolGroup'
import { ReasoningBlock } from './ReasoningBlock'
import { ErrorCard } from './ErrorCard'
import { WorkToolTimeline } from './WorkToolTimeline'
import { AskExchange } from './AskExchange'
import { CompactBoundaryMarker } from '../../common/transcript/CompactBoundaryMarker'
import { ForkBoundaryMarker } from '../../common/transcript/ForkBoundaryMarker'
import { SubagentNoticeRow } from '../../common/transcript/SubagentNoticeRow'
import type { MessageSegment } from '../../../lib/parts'
import type { AgentTranscriptPresentation } from '../../../lib/agentPresentation'
// Work의 도구 행만 전용 표현을 사용한다. 질문·오류·서브에이전트 계약은 함께 유지한다.
export const ClaudeAssistantSegment = memo(function ClaudeAssistantSegment({
  segment: seg,
  transcriptPolicy,
  partKeys,
  sourceParts,
  pendingText
}: {
  partKeys?: readonly string[]
  sourceParts?: readonly MarkdownSourcePart[]
  segment: MessageSegment
  transcriptPolicy: AgentTranscriptPresentation
  // Work 메모만 켠다 — 워커 응답 전에도 메모 글이 보이게 한다(0331 D-034 ③).
  pendingText?: boolean
}): React.JSX.Element {
  switch (seg.kind) {
    case 'reasoning':
      return <ReasoningBlock items={seg.items} />
    case 'tools':
      return transcriptPolicy.turnProjection === 'work-activity' ? (
        <WorkToolTimeline
          calls={seg.calls}
          transcriptPolicy={transcriptPolicy}
          partKeys={partKeys}
        />
      ) : (
        <ToolGroup calls={seg.calls} transcriptPolicy={transcriptPolicy} partKeys={partKeys} />
      )
    case 'ask':
      return <AskExchange call={seg.call} />
    case 'text':
      return (
        <TranscriptMarkdown
          source={seg.text}
          sourceParts={(sourceParts?.length ?? 0) > 1 ? sourceParts : undefined}
          pendingText={pendingText}
        />
      )
    case 'error':
      return <ErrorCard error={seg.error} failure={seg.failure} />
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
