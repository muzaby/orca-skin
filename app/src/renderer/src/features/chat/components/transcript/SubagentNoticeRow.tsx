import { memo, useMemo } from 'react'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { formatDurationLabel } from '../../lib/toolMeta'
import { subagentTaskDescription } from '../../lib/parts'
import { chatActions, useChatSession } from '../../store/chatStore'
import { TranscriptActionRow } from './TranscriptActionRow'

// 백그라운드 서브에이전트 완료 통지(0143, r2 — Claude Code web 패리티 평문 행). 카드 크롬 없이
// AgentTaskRow 와 동형의 한 줄 텍스트 행으로 렌더한다(행 셸은 TranscriptActionRow 공용):
//   `백그라운드 작업 완료 Agent "…" finished · 4분 43초 소요됨`
// subagent_notice 파트(라이브=settled+background 이벤트, 재로드=DB 파트)에서 렌더하며,
// description 은 파트에 없다 — toolRunId 로 부모 Task tool_call 과 조인한다(파생·복사 없음).
// 클릭 시 해당 태스크 상세(우측 패널). 실패는 summary(사유) 2줄째.
//
// 상태 → 표시는 한 표가 소유한다(0149 — 구 PREFIX_KEY/VERB 평행 Record 2개). 동사는 Claude Code
// web 표기 미러라 두 로케일 공통 영문이다.
const NOTICE: Record<'completed' | 'failed' | 'stopped', { key: MessageKey; verb: string }> = {
  completed: { key: 'chat.subagentNotice.completed', verb: 'finished' },
  failed: { key: 'chat.subagentNotice.failed', verb: 'failed' },
  stopped: { key: 'chat.subagentNotice.stopped', verb: 'stopped' }
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
    () => subagentTaskDescription(messages, toolRunId),
    [messages, toolRunId]
  )
  const durationLabel = formatDurationLabel(tr, durationMs)
  const notice = NOTICE[status]
  const detail = [
    ...(description
      ? [tr('chat.subagentNotice.agentLine', { title: description, verb: notice.verb })]
      : []),
    ...(durationLabel ? [tr('chat.subagentNotice.took', { duration: durationLabel })] : [])
  ].join(' · ')
  return (
    <div className="flex flex-col gap-1">
      <TranscriptActionRow
        groupClassName="group/notice"
        onActivate={() => chatActions.openSubagentTask(toolRunId)}
      >
        <span
          className={`shrink-0 ${status === 'failed' ? 'text-bad' : ''} group-hover/notice:text-t9`}
        >
          {tr(notice.key)}
        </span>
        {detail !== '' && (
          <span className="min-w-0 truncate group-hover/notice:text-t9">{detail}</span>
        )}
      </TranscriptActionRow>
      {status === 'failed' && summary && (
        <span className="line-clamp-2 text-caption text-t5">{summary}</span>
      )}
    </div>
  )
})
