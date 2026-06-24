import { useMemo } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { formatElapsed, useElapsed } from '../../../../shared/ui/elapsed'
import {
  modelDisplayLabel,
  subagentTasksFromMessages,
  type SubagentTaskStatus
} from '../../lib/parts'
import { toolDescription } from '../../lib/toolMeta'
import { chatActions, useChatSession, useSubagentMeta } from '../../store/chatStore'
import type { ToolCall } from '../../reducer/chatReducer'

// 서브에이전트(Task) 행의 상태별 접두 동사. 진행 중만 shimmer.
const PREFIX: Record<SubagentTaskStatus, string> = {
  running: '에이전트 실행 중',
  completed: '에이전트 완료',
  aborted: '에이전트 중단됨',
  failed: '에이전트 실패'
}

// 서브에이전트 Task 전용 행 — 일반 ToolCard 와 동일한 행 DOM/인터랙션(클릭 시 우측 패널)을
// 갖되, 라벨을 참고 UI 양식으로 구성한다. child 메타(모델·현재 도구·도구수·경과시간)는
// store 의 messages 에서 파생하므로 이 컴포넌트만 store 를 구독한다(일반 도구 카드는 비구독).
//
// 포맷(진행 중):
//  · 그룹 내: `에이전트 실행 중 {model} {title} {elapsed}`
//  · 단일:    `에이전트 실행 중 {model} · {현재 child 도구} · {child 도구수}`
// 완료/중단/실패: `에이전트 {상태} {model} {title}` (+ 완료 시 durationLabel).
export function AgentTaskRow({
  call,
  inGroup = false
}: {
  call: ToolCall
  inGroup?: boolean
}): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const summary = useMemo(
    () => subagentTasksFromMessages(messages).find((t) => t.toolUseId === call.toolUseId),
    [messages, call.toolUseId]
  )
  // 라이브 메타(진행 중 모델·시간·현재도구·도구수) — SDK task_*/child model 에서 누적.
  const live = useSubagentMeta(call.toolUseId)

  const status: SubagentTaskStatus = summary?.status ?? (call.result ? 'completed' : 'running')
  const running = status === 'running'
  // 진행 중 경과시간 앵커 — 라이브 메타의 startedAtMs(첫 task 이벤트 수신 시각)를 우선 사용해
  // 매 초 로컬 틱한다. 라이브 메타가 없으면(예: 세션 복원 직후) durationLabel 로 폴백.
  const elapsedSec = useElapsed(running ? (live?.startedAtMs ?? null) : null)

  // 모델: 라이브 메타 모델 → summary(영속/subagent_type) → 폴백.
  const model = live?.model ? modelDisplayLabel(live.model) : (summary?.agentLabel ?? '에이전트')
  const title = summary?.description ?? toolDescription(call)
  const isBad = status === 'failed'
  const currentTool = live?.lastToolName ?? summary?.currentChildLabel ?? '…'
  const toolCount = live?.toolUses ?? summary?.childToolCount ?? 0

  // 메타 문자열(접두 동사 우측). nbsp 가 아니라 일반 공백으로 단어 구분.
  let detail: string
  const elapsed = elapsedSec > 0 ? ` ${formatElapsed(elapsedSec)}` : ''
  if (running && !inGroup) {
    // 단일 항목: 모델 · 현재 도구 · 도구수 (+ 경과시간) — 피드백 3(개별 시간 추적).
    detail = `${model} · ${currentTool} · ${toolCount}${elapsed}`
  } else if (running) {
    detail = `${model} ${title}${elapsed}`
  } else {
    const duration = summary?.durationLabel ? ` ${summary.durationLabel}` : ''
    detail = `${model} ${title}${duration}`
  }

  const activate = (): void => chatActions.openSubagentTask(call.toolUseId)

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
      className="group/tool flex max-w-full cursor-pointer items-center gap-g2 self-start text-left text-body text-t6 outline-none hide-focus-ring ring-focus"
    >
      <span
        className={`shrink-0 ${
          isBad ? 'text-bad' : running ? 'epitaxy-text-shine' : 'group-hover/tool:text-t9'
        }`}
      >
        {PREFIX[status]}
      </span>
      {running && <span className="sr-only">실행 중</span>}
      <span className="min-w-0 truncate group-hover/tool:text-t9">{detail}</span>
      <span aria-hidden className="shrink-0">
        <Icon name="chevR" size={12} />
      </span>
    </div>
  )
}
