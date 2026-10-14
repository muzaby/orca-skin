import { memo, useState } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { Icon } from '../../../../../shared/ui/Icon'
import type { ToolCall } from '../../../reducer/chatReducer'
import type { AgentTranscriptPresentation } from '../../../lib/agentPresentation'
import { toolKind } from '../toolPresentation'
import { toolRunOutcome } from '../../../lib/parts'
import { OpenCodeToolCard } from './ToolCard'
import { groupTools } from './toolGrouping'
export const OpenCodeToolGroup = memo(function OpenCodeToolGroup({
  calls
}: {
  calls: ToolCall[]
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element | null {
  if (!calls.length) return null
  return (
    <div
      data-component="tool-part-wrapper"
      className="flex min-w-0 flex-col gap-[8px] text-[calc(13px*var(--transcript-text-scale,1))] font-[440] leading-[16px] text-oc-muted"
    >
      {groupTools(calls).map((group) =>
        group.length > 1 ? (
          <ContextTools key={group[0].toolUseId} calls={group} />
        ) : (
          <OpenCodeToolCard key={group[0].toolUseId} call={group[0]} />
        )
      )}
    </div>
  )
})
function ContextTools({ calls }: { calls: ToolCall[] }): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  const views = calls.map((call) => ({
    kind: toolKind(call),
    outcome: toolRunOutcome(call.result)
  }))
  const running = views.some((view) => view.outcome === 'running')
  const failed = views.some((view) => view.outcome === 'failed')
  const incomplete = views.some((view) => !['running', 'completed'].includes(view.outcome))
  return (
    <div data-component="context-tool-group">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[28px] max-w-full items-center gap-[6px] rounded-[6px] text-left outline-none ring-focus"
      >
        <span className={failed ? 'font-[530] text-oc-bad' : 'font-[530] text-oc-ink'}>
          {tr(
            running
              ? 'chat.opencode.explorationRunning'
              : incomplete
                ? 'chat.opencode.explorationIncomplete'
                : 'chat.opencode.explorationDone'
          )}
        </span>
        <span>
          {(['read', 'search', 'list'] as const)
            .filter((kind) => views.some((view) => view.kind === kind))
            .map(
              (kind) =>
                tr(`chat.opencode.tool.${kind}`) +
                ' ' +
                views.filter((view) => view.kind === kind).length
            )
            .join(' · ')}
        </span>
        <Icon name={open ? 'chevD' : 'chevR'} size={12} />
      </button>
      {open && (
        <div className="mt-[8px] flex flex-col gap-[8px] border-l border-oc-border pl-[12px]">
          {calls.map((call) => (
            <OpenCodeToolCard key={call.toolUseId} call={call} />
          ))}
        </div>
      )}
    </div>
  )
}
