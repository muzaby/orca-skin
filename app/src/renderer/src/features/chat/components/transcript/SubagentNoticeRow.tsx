import { memo, useMemo } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { formatDurationLabel } from '../../lib/toolMeta'
import { subagentTasksFromMessages } from '../../lib/parts'
import { chatActions, useChatSession } from '../../store/chatStore'

// 백그라운드 서브에이전트 완료 통지(0143) — Claude Code web 의 "백그라운드 작업 완료 ·
// Agent "…" finished · 4m 43s" 패리티. subagent_notice 파트(라이브=settled+background 이벤트,
// 재로드=DB 파트)에서 렌더한다. description 은 파트에 없다 — toolRunId 로 부모 Task tool_call
// (subagentTasksFromMessages)과 조인한다(파생·복사 없음). 클릭 시 해당 태스크 상세(우측 패널).
const TITLE_KEY: Record<'completed' | 'failed' | 'stopped', MessageKey> = {
  completed: 'chat.subagentNotice.completed',
  failed: 'chat.subagentNotice.failed',
  stopped: 'chat.subagentNotice.stopped'
}

interface SubagentNoticeRowProps {
  toolRunId: string
  status: 'completed' | 'failed' | 'stopped'
  durationMs?: number
  summary?: string
}

export const SubagentNoticeRow = memo(function SubagentNoticeRow({
  toolRunId,
  status,
  durationMs,
  summary
}: SubagentNoticeRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const messages = useChatSession((s) => s.messages)
  const description = useMemo(
    () => subagentTasksFromMessages(messages).find((t) => t.toolUseId === toolRunId)?.description,
    [messages, toolRunId]
  )
  const durationLabel = formatDurationLabel(tr, durationMs)
  const line = [
    tr(TITLE_KEY[status]),
    ...(description ? [tr('chat.subagentNotice.agentLine', { title: description })] : []),
    ...(durationLabel ? [durationLabel] : [])
  ].join(' · ')
  const activate = (): void => chatActions.openSubagentTask(toolRunId)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      className="group/notice flex w-fit max-w-full cursor-pointer flex-col gap-1 rounded-lg border border-border bg-bg2 px-3 py-2 text-body outline-none hide-focus-ring ring-focus"
    >
      <span
        className={`flex items-center gap-1.5 ${status === 'failed' ? 'text-bad' : 'text-t6'} group-hover/notice:text-t9`}
      >
        <Icon name="chevR" size={12} />
        <span className="min-w-0 truncate">{line}</span>
      </span>
      {summary && <span className="line-clamp-2 text-caption text-t5">{summary}</span>}
    </div>
  )
})
