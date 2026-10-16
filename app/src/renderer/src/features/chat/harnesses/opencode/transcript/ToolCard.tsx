import { memo, useMemo } from 'react'
import { OpenCodeIcon } from '../Icon'
import { useI18n } from '../../../../../shared/i18n'
import type { ToolCall } from '../../../reducer/chatReducer'
import { describeTool } from '../toolPresentation'
import { OpenCodeSpinner } from '../Spinner'
import { ToolBody } from './ToolBody'
import { chatActions } from '../../../store/chatStore'
import { useToolDisclosure } from './viewState'
import { fileChanges, fileName } from './filePresentation'

export const OpenCodeToolCard = memo(function OpenCodeToolCard({
  call
}: {
  call: ToolCall
}): React.JSX.Element {
  const { tr } = useI18n()
  const view = useMemo(() => describeTool(call), [call])
  const changes = useMemo(() => fileChanges(view.files), [view.files])
  const [open, setOpen] = useToolDisclosure(`tool:${call.toolUseId}`, false)
  const running = view.outcome === 'running'
  const failed = view.outcome === 'failed'
  const task = view.kind === 'task'
  const webLink = view.kind === 'web' && view.url && view.outcome === 'completed'
  const nativeName = view.name.toLowerCase()
  const title =
    task && view.agent
      ? view.agent.charAt(0).toUpperCase() + view.agent.slice(1)
      : nativeName === 'skill' && view.subtitle
        ? view.subtitle
        : ['glob', 'grep', 'skill'].includes(nativeName)
          ? view.name.charAt(0).toUpperCase() + view.name.slice(1)
          : view.kind === 'generic'
            ? view.name
            : tr(`chat.opencode.tool.${view.kind}`)
  const subtitle = view.path ? fileName(view.path) : view.subtitle
  const chrome =
    'group/oc-tool flex min-h-[28px] max-w-full min-w-0 items-center gap-[6px] rounded-[6px] text-left outline-none ring-focus'
  return (
    <div
      data-component="opencode-tool"
      data-tool-kind={view.kind}
      data-outcome={view.outcome}
      className="min-w-0 text-[calc(13px*var(--transcript-text-scale,1))] font-[440] leading-[20px] tracking-[-0.04px] text-oc-muted"
    >
      {webLink ? (
        <div className={chrome}>
          <span className="shrink-0 font-[530] text-oc-ink">{title}</span>
          <a
            href={view.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-[8px] text-oc-accent hover:underline outline-none ring-focus"
          >
            <span className="truncate">{view.url}</span>
            <OpenCodeIcon name="outline-square-arrow" className="text-oc-faint" />
          </a>
        </div>
      ) : (
        <button
          type="button"
          data-slot="collapsible-trigger"
          aria-expanded={task ? undefined : open}
          onClick={() =>
            task ? chatActions.openSubagentTask(call.toolUseId) : setOpen((value) => !value)
          }
          className={`${chrome} ${task ? 'w-fit gap-[8px] rounded-[8px] bg-oc-layer-1 px-[12px] py-[8px] hover:bg-oc-layer-2' : 'w-full'}`}
        >
          {running && <OpenCodeSpinner />}
          {failed && <OpenCodeIcon name="circle-exclamation" className="text-oc-bad" />}
          {task && !running && !failed && (
            <OpenCodeIcon name="folder" size={14} className="text-oc-faint" />
          )}
          <span
            data-component="tool-trigger"
            className={`flex min-w-0 items-baseline gap-[6px] ${failed ? 'text-oc-bad' : 'group-hover/oc-tool:text-oc-ink'}`}
          >
            <span className="shrink-0 font-[530] text-oc-ink" title={view.name}>
              {title}
            </span>
            {nativeName !== 'skill' && !(view.kind === 'shell' && open) && (
              <span className="truncate" title={view.subtitle}>
                {subtitle}
              </span>
            )}
            {view.arguments && (
              <span className="min-w-0 truncate" title={view.arguments}>
                {view.arguments}
              </span>
            )}
            {!running && view.outcome !== 'completed' && (
              <span className="shrink-0">{tr(`chat.toolMeta.agentStatus.${view.outcome}`)}</span>
            )}
          </span>
          {view.kind === 'edit' && (changes.added > 0 || changes.removed > 0) && (
            <span
              data-slot="tool-diff-summary"
              className="flex shrink-0 gap-[6px] text-[calc(11px*var(--transcript-text-scale,1))]"
            >
              <span className="text-oc-good">+{changes.added}</span>
              <span className="text-oc-bad">−{changes.removed}</span>
            </span>
          )}
          {running && <span className="sr-only">{tr('common.running')}</span>}
          {!task && (
            <OpenCodeIcon
              name="chevron-down"
              size={14}
              className={`${open ? '' : '-rotate-90'} text-oc-faint opacity-0 group-hover/oc-tool:opacity-100 group-focus-visible/oc-tool:opacity-100 ${failed || open ? 'opacity-100' : ''}`}
            />
          )}
        </button>
      )}
      {!webLink && !task && open && (
        <div className="mt-[8px]">
          <ToolBody view={view} disclosureKey={call.toolUseId} />
        </div>
      )}
    </div>
  )
})
