import { memo } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { chatActions } from '../../store/chatStore'
import { deriveSubagentTaskStatus, formatDurationLabel } from '../../lib/parts'
import { toolDescription } from '../../lib/toolMeta'
import type { ToolCall } from '../../reducer/chatReducer'

const STATUS_LABEL = {
  running: '실행 중',
  completed: '완료',
  failed: '실패',
  aborted: '중지됨'
} as const

function agentLabel(call: ToolCall): string {
  const input =
    typeof call.input === 'object' && call.input !== null
      ? (call.input as Record<string, unknown>)
      : {}
  const result =
    typeof call.result?.output === 'object' && call.result.output !== null
      ? (call.result.output as Record<string, unknown>)
      : {}
  const label = result.agentLabel ?? input.agentLabel ?? input.subagent_type
  return typeof label === 'string' && label.trim() !== '' ? label : '에이전트'
}

export const AgentTaskCard = memo(function AgentTaskCard({
  call
}: {
  call: ToolCall
}): React.JSX.Element {
  const status = deriveSubagentTaskStatus(call)
  const description = toolDescription(call)
  const durationLabel = formatDurationLabel(call.result?.durationMs)
  return (
    <button
      type="button"
      onClick={() => chatActions.openSubagentTask(call.toolUseId)}
      className="group/agenttask flex w-full max-w-[760px] flex-col gap-g1 rounded-r5 border border-t5 bg-bg px-p5 py-p4 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
      aria-label={`${description} 대화록 보기`}
    >
      <div className="flex min-w-0 items-center gap-g2 text-footnote">
        <span className="shrink-0 font-semibold text-accent">실행됨</span>
        <span className="min-w-0 truncate font-semibold text-t8">
          에이전트 실행한 {agentLabel(call)} {description} {STATUS_LABEL[status]}
        </span>
        <span className="ml-auto shrink-0 text-t6 transition-transform group-hover/agenttask:translate-x-0.5">
          <Icon name="chevR" size={12} />
        </span>
      </div>
      <div className="min-w-0 truncate text-caption text-ink3">
        백그라운드 작업 {STATUS_LABEL[status]} {description}
        {durationLabel ? ` · ${durationLabel}` : ''}
      </div>
    </button>
  )
})
