import { useState } from 'react'
import { useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'
import { toolDescription, toolDiffStat } from '../../lib/toolMeta'
import type { ToolCall } from '../../reducer/chatReducer'
import type { AgentTranscriptPresentation } from '../../lib/agentPresentation'
import { ToolCard } from './ToolCard'
import { stringify } from '../../format'

const EXPLORATION_TOOLS = new Set(['Read', 'Glob', 'Grep', 'List'])

export function OpenCodeToolGroup({
  calls,
  transcriptPolicy
}: {
  calls: ToolCall[]
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const [expanded, setExpanded] = useState(false)
  if (!calls.length) return null
  const exploration = calls.length > 1 && calls.every((call) => EXPLORATION_TOOLS.has(call.name))
  const running = calls.some((call) => call.result == null)
  return (
    <div
      data-component="tool-part-wrapper"
      className="flex flex-col gap-2 text-[calc(13px*var(--transcript-text-scale,1))] leading-[1.615] text-oc-muted"
    >
      {exploration && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex items-center gap-2 self-start rounded-md text-left font-medium outline-none ring-focus"
        >
          <Icon name={expanded ? 'chevD' : 'chevR'} size={12} />
          {tr(
            running ? 'chat.opencode.explorationRunning' : 'chat.opencode.explorationDone'
          )} · {calls.length}
        </button>
      )}
      {(!exploration || expanded) &&
        calls.map((call) => (
          <OpenCodeToolRow key={call.toolUseId} call={call} transcriptPolicy={transcriptPolicy} />
        ))}
    </div>
  )
}

function OpenCodeToolRow({
  call,
  transcriptPolicy
}: {
  call: ToolCall
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(call.name === 'Edit' || call.name === 'Write')
  const stat = toolDiffStat(call)
  return (
    <div className="tool-collapsible min-w-0">
      <button
        type="button"
        data-slot="collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group/oc-tool flex w-full min-w-0 items-center gap-2 rounded-md text-left outline-none ring-focus"
      >
        <Icon name={open ? 'chevD' : 'chevR'} size={12} />
        <span
          data-component="tool-trigger"
          className={`flex min-w-0 items-center gap-2 font-medium ${call.result?.isError ? 'text-bad' : 'group-hover/oc-tool:text-oc-ink'}`}
        >
          <span className="shrink-0">{call.providerTool?.name ?? call.name}</span>
          <span className="truncate font-normal">
            {toolDescription(call, tr('chat.toolMeta.planDescription'))}
          </span>
          {stat && (
            <span className="shrink-0 font-mono text-caption">
              <span className="text-extended-green">+{stat.added}</span>{' '}
              <span className="text-extended-pink">−{stat.removed}</span>
            </span>
          )}
        </span>
        {!call.result && <span className="sr-only">{tr('common.running')}</span>}
      </button>
      {open && (
        <div className="pl-5">
          <ToolCard call={call} transcriptPolicy={transcriptPolicy} presentation="detail-body" />
          {call.providerTool && (
            <details className="mt-2 rounded-md border border-oc-border p-2">
              <summary className="cursor-pointer text-caption">
                {tr('chat.opencode.originalTool')}
              </summary>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-caption">
                {stringify(call.providerTool)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
