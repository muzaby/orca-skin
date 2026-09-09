import { memo, useId, useState } from 'react'
import { useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'
import { isAgentTaskName } from '../../lib/parts'
import { workToolPresentation } from '../../lib/workToolPresentation'
import type { AgentTranscriptPresentation } from '../../lib/agentPresentation'
import type { ToolCall } from '../../reducer/chatReducer'
import { ToolCard } from './ToolCard'
import { WorkToolBody } from './WorkToolBody'

export const WorkToolRow = memo(function WorkToolRow({
  call
}: {
  call: ToolCall
}): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const view = workToolPresentation(call)
  const label =
    view.description ??
    `${view.labelKey ? tr(view.labelKey) : call.name}${view.target ? ` ${view.target}` : ''}`
  const failed = view.status === 'failed'
  return (
    <div
      className="relative py-2 pl-[30px]"
      data-work-tool={call.toolUseId}
      data-tool-status={view.status}
    >
      <span
        aria-hidden
        className={`absolute top-2.5 left-0 flex h-5 w-5 items-center justify-center bg-bg ${failed ? 'text-bad' : 'text-ink3'}`}
      >
        {view.icon ? (
          <Icon name={view.icon} size={16} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        title={label}
        onClick={() => setOpen(!open)}
        className={`group/work-tool flex max-w-full items-center gap-1.5 rounded-r4 py-0.5 text-left text-body outline-none ring-focus ${failed ? 'text-bad' : 'text-ink3 hover:text-ink2'}`}
      >
        <span
          className={`min-w-0 truncate ${view.status === 'running' ? 'epitaxy-text-shine' : ''}`}
        >
          {label}
        </span>
        <Icon
          name="chevR"
          size={12}
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {view.status === 'running' && <span className="sr-only">{tr('common.running')}</span>}
        {view.status === 'aborted' && (
          <span className="shrink-0 text-caption">{tr('chat.toolMeta.aborted')}</span>
        )}
        {failed && <span className="sr-only">{tr('chat.workTool.error')}</span>}
      </button>
      {open && (
        <div id={bodyId} className="mt-2">
          <WorkToolBody call={call} />
        </div>
      )}
    </div>
  )
})

// `rail=false`이면 WorkActivity가 메모를 포함한 연속 세로선을 소유한다. 경계 없는
// 과거 Work 기록은 이 컴포넌트가 도구 그룹의 선을 소유하고 같은 행 표현을 사용한다.
export const WorkToolTimeline = memo(function WorkToolTimeline({
  calls,
  transcriptPolicy,
  rail = true
}: {
  calls: ToolCall[]
  transcriptPolicy: AgentTranscriptPresentation
  rail?: boolean
}): React.JSX.Element {
  return (
    <div className="relative min-w-0" data-work-tools="true">
      {rail && calls.length > 1 && (
        <div aria-hidden className="absolute top-4 bottom-4 left-[9px] border-l border-border" />
      )}
      {calls.map((call) =>
        isAgentTaskName(call.name) ? (
          <div key={call.toolUseId} className="relative py-2 pl-[30px]">
            <span
              aria-hidden
              className="absolute top-2.5 left-0 flex h-5 w-5 items-center justify-center bg-bg text-ink3"
            >
              <Icon name="cpu" size={16} />
            </span>
            <ToolCard call={call} transcriptPolicy={transcriptPolicy} />
          </div>
        ) : (
          <WorkToolRow key={call.toolUseId} call={call} />
        )
      )}
    </div>
  )
})
