import { memo, useMemo, useState } from 'react'
import { OpenCodeIcon, type OpenCodeIconName } from '../Icon'
import { useI18n } from '../../../../../shared/i18n'
import type { ToolCall } from '../../../reducer/chatReducer'
import { describeTool } from '../toolPresentation'
import { OpenCodeSpinner } from '../Spinner'
import { ToolBody } from './ToolBody'

const toolIcons: Record<ReturnType<typeof describeTool>['kind'], OpenCodeIconName> = {
  read: 'code-slash',
  search: 'magnifying-glass',
  list: 'folder',
  shell: 'code-slash',
  edit: 'edit',
  write: 'edit',
  web: 'globe',
  task: 'code-slash',
  todo: 'check',
  generic: 'code-slash'
}
export const OpenCodeToolCard = memo(function OpenCodeToolCard({
  call
}: {
  call: ToolCall
}): React.JSX.Element {
  const { tr } = useI18n()
  const view = useMemo(() => describeTool(call), [call])
  const [open, setOpen] = useState(view.kind === 'edit' || view.kind === 'write')
  const running = view.outcome === 'running'
  return (
    <div
      data-component="opencode-tool"
      data-tool-kind={view.kind}
      data-outcome={view.outcome}
      className="min-w-0 text-[calc(13px*var(--transcript-text-scale,1))] font-[440] leading-[16px] tracking-[-0.04px] text-oc-muted"
    >
      <button
        type="button"
        data-slot="collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group/oc-tool flex min-h-[28px] w-full min-w-0 items-center gap-[6px] rounded-[6px] text-left outline-none ring-focus"
      >
        {running ? (
          <OpenCodeSpinner />
        ) : (
          <OpenCodeIcon
            name={view.outcome === 'failed' ? 'circle-exclamation' : toolIcons[view.kind]}
            className={view.outcome === 'failed' ? 'text-oc-bad' : 'text-oc-faint'}
          />
        )}
        <span
          data-component="tool-trigger"
          className={`flex min-w-0 items-center gap-[6px] ${view.outcome === 'failed' ? 'text-oc-bad' : 'group-hover/oc-tool:text-oc-ink'}`}
        >
          <span className="shrink-0 font-[530] text-oc-ink" title={view.name}>
            {view.kind === 'generic' ? view.name : tr(`chat.opencode.tool.${view.kind}`)}
          </span>
          <span className="truncate" title={view.subtitle}>
            {view.subtitle}
          </span>
          {view.arguments && <span className="shrink-0 text-[inherit]">{view.arguments}</span>}
          {!running && view.outcome !== 'completed' && (
            <span className="shrink-0 text-[inherit]">
              {tr(`chat.toolMeta.agentStatus.${view.outcome}`)}
            </span>
          )}
        </span>
        {running && <span className="sr-only">{tr('common.running')}</span>}
        <OpenCodeIcon
          name="chevron-down"
          size={14}
          className={`${open ? '' : '-rotate-90'} text-oc-faint opacity-0 group-hover/oc-tool:opacity-100 group-focus-visible/oc-tool:opacity-100 ${view.outcome === 'failed' || open ? 'opacity-100' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-[8px]">
          <ToolBody view={view} />
        </div>
      )}
    </div>
  )
})
