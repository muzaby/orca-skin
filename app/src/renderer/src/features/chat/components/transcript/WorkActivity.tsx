import { memo, useState } from 'react'
import { AssistantMessage, AssistantSegment } from './AssistantMessage'
import { createWorkProjector, type WorkActivityNode } from '../../lib/workActivity'
import type { Message } from '../../reducer/chatReducer'
import { useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'
import type { WorkToolResults } from '../../lib/workToolResults'
import type { AgentTranscriptPresentation } from '../../lib/agentPresentation'
import { WorkToolTimeline } from './WorkToolTimeline'

export const WorkActivity = memo(function WorkActivity({
  messages,
  toolResults,
  transcriptPolicy
}: {
  messages: Message[]
  toolResults?: WorkToolResults
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element {
  const [project] = useState(createWorkProjector)
  const { tr } = useI18n()
  const nodes = project(messages, toolResults)
  if (!nodes)
    return (
      <>
        {messages.map((message, index) => (
          <AssistantMessage key={index} message={message} transcriptPolicy={transcriptPolicy} />
        ))}
      </>
    )
  return (
    <div
      className="flex flex-col gap-[var(--chat-item-gap)] text-[14px] leading-[1.7] text-ink"
      data-agent="work"
    >
      {nodes.map((node) =>
        node.kind === 'segment' ? (
          <AssistantSegment
            key={node.key}
            segment={node.segment}
            transcriptPolicy={transcriptPolicy}
          />
        ) : node.kind === 'activity' ? (
          <ActivityDisclosure key={node.key} node={node} transcriptPolicy={transcriptPolicy} />
        ) : node.outcome === 'ended' || node.outcome === 'unknown' ? null : (
          <span
            key={node.key}
            className="text-caption text-ink3"
            data-response-outcome={node.outcome}
          >
            {tr(`chat.agent.${node.outcome}`)}
          </span>
        )
      )}
      {messages.some((message) => message.incomplete) && (
        <span className="text-caption text-ink3">{tr('chat.transcript.incompleteResponse')}</span>
      )}
    </div>
  )
})

function ActivityDisclosure({
  node,
  transcriptPolicy
}: {
  node: Extract<WorkActivityNode, { kind: 'activity' }>
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-w-0 text-ink2" data-work-activity="true">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex max-w-full items-center gap-1.5 rounded-r4 py-1 text-left text-caption text-ink3 outline-none ring-focus hover:text-ink2"
      >
        <span>
          {tr('chat.agent.activity', { tools: node.toolCount })}
          {node.noteCount > 0 && (
            <> · {tr('chat.agent.activityNotes', { notes: node.noteCount })}</>
          )}
        </span>
        <Icon
          name="chevR"
          size={12}
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="relative mt-2">
          <div aria-hidden className="absolute top-4 bottom-4 left-[9px] border-l border-border" />
          {node.items.map((item) =>
            item.segment.kind === 'tools' ? (
              <WorkToolTimeline
                key={item.key}
                calls={item.segment.calls}
                transcriptPolicy={transcriptPolicy}
                rail={false}
              />
            ) : item.segment.kind === 'text' ? (
              <div key={item.key} className="relative py-2 pl-[30px]" data-work-note="true">
                <span
                  aria-hidden
                  className="absolute top-2.5 left-0 flex h-5 w-5 items-center justify-center bg-bg text-ink3"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </span>
                <AssistantSegment segment={item.segment} transcriptPolicy={transcriptPolicy} />
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
