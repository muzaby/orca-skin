import { memo, useMemo } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { formatDurationLabel } from '../../lib/toolMeta'
import { subagentTasksFromMessages } from '../../lib/parts'
import { chatActions, useChatSession } from '../../store/chatStore'

// 백그라운드 서브에이전트 완료 통지(0143, r2 — Claude Code web 패리티 평문 행). 카드 크롬 없이
// AgentTaskRow 와 동형의 한 줄 텍스트 행으로 렌더한다:
//   `백그라운드 작업 완료 Agent "…" finished · 4분 43초 소요됨`
// subagent_notice 파트(라이브=settled+background 이벤트, 재로드=DB 파트)에서 렌더하며,
// description 은 파트에 없다 — toolRunId 로 부모 Task tool_call(subagentTasksFromMessages)과
// 조인한다(파생·복사 없음). 클릭 시 해당 태스크 상세(우측 패널). 실패는 summary(사유) 2줄째.
const PREFIX_KEY: Record<'completed' | 'failed' | 'stopped', MessageKey> = {
  completed: 'chat.subagentNotice.completed',
  failed: 'chat.subagentNotice.failed',
  stopped: 'chat.subagentNotice.stopped'
}

// Claude Code web 표기 미러 — 상태 동사는 두 로케일 공통 영문(finished/failed/stopped).
const VERB: Record<'completed' | 'failed' | 'stopped', string> = {
  completed: 'finished',
  failed: 'failed',
  stopped: 'stopped'
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
  const detail = [
    ...(description
      ? [tr('chat.subagentNotice.agentLine', { title: description, verb: VERB[status] })]
      : []),
    ...(durationLabel ? [tr('chat.subagentNotice.took', { duration: durationLabel })] : [])
  ].join(' · ')
  const activate = (): void => chatActions.openSubagentTask(toolRunId)
  return (
    <div className="flex flex-col gap-1">
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
        className="group/notice flex max-w-full cursor-pointer items-center gap-g2 self-start text-left text-body text-t6 outline-none hide-focus-ring ring-focus"
      >
        <span
          className={`shrink-0 ${status === 'failed' ? 'text-bad' : ''} group-hover/notice:text-t9`}
        >
          {tr(PREFIX_KEY[status])}
        </span>
        {detail !== '' && (
          <span className="min-w-0 truncate group-hover/notice:text-t9">{detail}</span>
        )}
        <span aria-hidden className="shrink-0">
          <Icon name="chevR" size={12} />
        </span>
      </div>
      {status === 'failed' && summary && (
        <span className="line-clamp-2 text-caption text-t5">{summary}</span>
      )}
    </div>
  )
})
