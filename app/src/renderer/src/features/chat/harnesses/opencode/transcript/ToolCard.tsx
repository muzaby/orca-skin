import { memo, useMemo, useState } from 'react'
import { Icon } from '../../../../../shared/ui/Icon'
import { useI18n } from '../../../../../shared/i18n'
import type { ToolCall } from '../../../reducer/chatReducer'
import { describeTool } from '../toolPresentation'
import { OpenCodeSpinner } from '../Spinner'
import { ToolBody } from './ToolBody'

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
      className="min-w-0"
    >
      <button
        type="button"
        data-slot="collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group/oc-tool flex w-full min-w-0 items-center gap-2 rounded-md text-left outline-none ring-focus"
      >
        {running && <OpenCodeSpinner />}
        <span
          data-component="tool-trigger"
          className={`flex min-w-0 flex-1 items-baseline gap-2 ${view.outcome === 'failed' ? 'text-bad' : 'group-hover/oc-tool:text-oc-ink'}`}
        >
          <span className="shrink-0 font-medium text-oc-ink" title={view.name}>
            {view.kind === 'generic' ? view.name : tr(`chat.opencode.tool.${view.kind}`)}
          </span>
          <span className="truncate" title={view.subtitle}>
            {view.subtitle}
          </span>
          {view.arguments && <span className="shrink-0 text-caption">{view.arguments}</span>}
          {!running && view.outcome !== 'completed' && (
            <span className="shrink-0 text-caption">
              {tr(`chat.toolMeta.agentStatus.${view.outcome}`)}
            </span>
          )}
        </span>
        {running && <span className="sr-only">{tr('common.running')}</span>}
        <Icon name={open ? 'chevD' : 'chevR'} size={12} />
      </button>
      {open && (
        <div className="mt-2">
          <ToolBody view={view} />
        </div>
      )}
    </div>
  )
})
