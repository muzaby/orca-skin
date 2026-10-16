import { memo } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { OpenCodeIcon } from '../Icon'
import type { ToolCall } from '../../../reducer/chatReducer'
import type { AgentTranscriptPresentation } from '../../../lib/agentPresentation'
import { toolKind } from '../toolPresentation'
import { toolRunOutcome } from '../../../lib/parts'
import { OpenCodeToolCard } from './ToolCard'
import { groupTools } from './toolGrouping'
import { useToolDisclosure } from './viewState'
export const OpenCodeToolGroup = memo(function OpenCodeToolGroup({
  calls
}: {
  calls: ToolCall[]
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element | null {
  const visible = calls.filter((call) => toolKind(call) !== 'todo')
  if (!visible.length) return null
  return (
    <div
      data-component="tool-part-wrapper"
      className="flex min-w-0 flex-col gap-[8px] text-[calc(13px*var(--transcript-text-scale,1))] font-[440] leading-[16px] text-oc-muted"
    >
      {groupTools(visible).map((group) =>
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
  const [open, setOpen] = useToolDisclosure(`context:${calls[0].toolUseId}`, false)
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
        className={`group/oc-context flex max-w-full items-center gap-[6px] rounded-[6px] text-left outline-none ring-focus ${open ? 'sticky top-[var(--oc-sticky-top)] z-20 min-h-[36px] bg-bg pb-[8px]' : 'min-h-[28px]'}`}
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
            .map((kind) =>
              tr(`chat.opencode.explorationCount.${kind}`, {
                count: views.filter((view) => view.kind === kind).length
              })
            )
            .join(', ')}
        </span>
        <OpenCodeIcon
          name="chevron-down"
          size={14}
          className={`${open ? '' : '-rotate-90 opacity-0 group-hover/oc-context:opacity-100 group-focus-visible/oc-context:opacity-100'} text-oc-faint`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-[4px] pl-[12px] [--oc-sticky-top:36px]">
          {calls.map((call) => (
            <OpenCodeToolCard key={call.toolUseId} call={call} />
          ))}
        </div>
      )}
    </div>
  )
}
