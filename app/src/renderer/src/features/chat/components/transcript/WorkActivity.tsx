import { memo, useState } from 'react'
import { AssistantMessage, AssistantSegment } from './AssistantMessage'
import { createWorkProjector, type WorkActivityNode } from '../../lib/workActivity'
import type { Message } from '../../reducer/chatReducer'
import { useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'
import type { WorkToolResults } from '../../lib/workToolResults'

export const WorkActivity = memo(function WorkActivity({
  messages,
  toolResults
}: {
  messages: Message[]
  toolResults?: WorkToolResults
}): React.JSX.Element {
  const [project] = useState(createWorkProjector)
  const { tr } = useI18n()
  const nodes = project(messages, toolResults)
  if (!nodes)
    return (
      <>
        {messages.map((message, index) => (
          <AssistantMessage key={index} message={message} />
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
          <AssistantSegment key={node.key} segment={node.segment} />
        ) : node.kind === 'activity' ? (
          <ActivityDisclosure key={node.key} node={node} />
        ) : (
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
  node
}: {
  node: Extract<WorkActivityNode, { kind: 'activity' }>
}): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-r6 border border-border bg-bg2 text-ink2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-g2 rounded-r6 px-p5 py-p4 text-left text-caption focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Icon name="chevR" size={14} className={open ? 'rotate-90' : ''} />
        {tr('chat.agent.activity', { tools: node.toolKinds, notes: node.noteCount })}
      </button>
      {open && (
        <div className="flex flex-col gap-g3 border-t border-border px-p5 py-p4">
          {node.items.map((item) => (
            <AssistantSegment key={item.key} segment={item.segment} />
          ))}
        </div>
      )}
    </div>
  )
}
