import { memo, useMemo, useState } from 'react'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { formatDurationLabel } from '../../lib/toolMeta'
import { subagentTaskJoin } from '../../lib/parts'
import { chatActions, useChatSession } from '../../store/chatStore'
import { TranscriptActionRow } from './TranscriptActionRow'
import { InlineSubagentDetail } from './InlineSubagentDetail'
import type { AgentTranscriptPresentation } from '../../lib/agentPresentation'

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
  transcriptPolicy: AgentTranscriptPresentation
}

export const SubagentNoticeRow = memo(function SubagentNoticeRow({
  toolRunId,
  status,
  durationMs,
  summary,
  transcriptPolicy
}: SubagentNoticeRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const messages = useChatSession((s) => s.messages)
  const [expanded, setExpanded] = useState(false)
  const joined = useMemo(() => subagentTaskJoin(messages, toolRunId), [messages, toolRunId])
  const description = joined?.description
  // 셸 백그라운드 작업은 **하위 대화록이 없다** — 상세로 들어가면 stdout 이 "에이전트 답변"
  // 자리에 명령도 맥락도 없이 그려진다. 우측 패널 카드에서 이미 막은 규칙을 통지 행에도 같게
  // 건다(0230 r2 · D3): 진입 어포던스 자체를 주지 않는다.
  const hasDetail = joined?.kind !== 'shell'
  const inlineDetail = hasDetail && transcriptPolicy.inlineSubagentDetail
  const durationLabel = formatDurationLabel(tr, durationMs)
  const notice = NOTICE[status]
  // 종류 라벨(0231 D-106 · §10 EP-207) — 어포던스와 **같은 `joined.kind` 하나**가 가른다. 고정
  // `Agent "…"` 문구는 셸 명령을 `Agent "npx vitest run" finished` 로 불렀다(0230 verify r2 D6).
  const lineKey =
    joined?.kind === 'shell'
      ? 'chat.subagentNotice.shellLine'
      : ('chat.subagentNotice.agentLine' as const)
  const detail = [
    ...(description ? [tr(lineKey, { title: description, verb: notice.verb })] : []),
    ...(durationLabel ? [tr('chat.subagentNotice.took', { duration: durationLabel })] : [])
  ].join(' · ')
  // 갈 곳이 없는 행은 hover 에도 반응하지 않는다 — 행 셸이 role·포인터·꺾쇠를 이미 막는데
  // (`TranscriptActionRow`) 자식의 hover 틴트만 남으면 누를 수 없는 줄이 눌릴 것처럼 밝아진다.
  const hoverTint = hasDetail ? 'group-hover/notice:text-t9' : ''
  return (
    <div className="flex flex-col gap-1">
      <TranscriptActionRow
        groupClassName="group/notice"
        expanded={inlineDetail ? expanded : undefined}
        onActivate={
          hasDetail
            ? () => {
                if (inlineDetail) setExpanded((value) => !value)
                else chatActions.openSubagentTask(toolRunId)
              }
            : undefined
        }
      >
        <span className={`shrink-0 ${status === 'failed' ? 'text-bad' : ''} ${hoverTint}`}>
          {tr(notice.key)}
        </span>
        {detail !== '' && <span className={`min-w-0 truncate ${hoverTint}`}>{detail}</span>}
      </TranscriptActionRow>
      {inlineDetail && expanded && (
        <InlineSubagentDetail toolRunId={toolRunId} transcriptPolicy={transcriptPolicy} />
      )}
      {status === 'failed' && summary && (
        <span className="line-clamp-2 text-caption text-t5">{summary}</span>
      )}
    </div>
  )
})
