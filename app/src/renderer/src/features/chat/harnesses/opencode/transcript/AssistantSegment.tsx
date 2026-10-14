import { memo } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { Icon } from '../../../../../shared/ui/Icon'
import type { MessageSegment } from '../../../lib/parts'
import type { AgentTranscriptPresentation } from '../../../lib/agentPresentation'
import { errorCategoryKey } from '../../../lib/errorLabels'
import { stringify } from '../../../format'
import { AskExchange } from '../../../components/transcript/AskExchange'
import { CompactBoundaryMarker } from '../../../components/transcript/CompactBoundaryMarker'
import { ForkBoundaryMarker } from '../../../components/transcript/ForkBoundaryMarker'
import { SubagentNoticeRow } from '../../../components/transcript/SubagentNoticeRow'
import { OpenCodeToolGroup } from './ToolGroup'
import { OpenCodeText, OpenCodeReasoning } from './Text'
import { OutputPanel } from './ToolBody'

export const OpenCodeAssistantSegment = memo(function OpenCodeAssistantSegment({
  segment: seg,
  transcriptPolicy
}: {
  segment: MessageSegment
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element {
  const { tr } = useI18n()
  switch (seg.kind) {
    case 'text':
      return <OpenCodeText source={seg.text} />
    case 'reasoning':
      return <OpenCodeReasoning items={seg.items} />
    case 'tools':
      return <OpenCodeToolGroup calls={seg.calls} transcriptPolicy={transcriptPolicy} />
    case 'ask':
      return <AskExchange call={seg.call} />
    case 'structured':
      return (
        <div data-component="opencode-structured">
          <p className="mb-2 text-caption text-oc-muted">
            {tr('chat.transcript.structuredOutput')}
          </p>
          <OutputPanel
            text={typeof seg.value === 'string' ? seg.value : stringify(seg.value)}
            label={tr('chat.transcript.structuredOutput')}
          />
        </div>
      )
    case 'error':
      return <OpenCodeError error={seg.error} />
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
function OpenCodeError({ error }: { error: unknown }): React.JSX.Element {
  const { tr } = useI18n()
  const data = error != null && typeof error === 'object' ? (error as Record<string, unknown>) : {}
  const category = typeof data.category === 'string' ? errorCategoryKey(data.category) : null
  const message =
    typeof data.message === 'string'
      ? data.message
      : typeof error === 'string'
        ? error
        : stringify(error)
  return (
    <div
      data-component="opencode-error"
      className="flex gap-2 rounded-md border border-bad/40 px-3 py-2 text-[calc(13px*var(--transcript-text-scale,1))] text-bad"
    >
      <Icon name="alert" size={16} />
      <div className="min-w-0">
        {category && <div className="font-medium">{tr(category)}</div>}
        <p className="whitespace-pre-wrap break-words">{message}</p>
      </div>
    </div>
  )
}
