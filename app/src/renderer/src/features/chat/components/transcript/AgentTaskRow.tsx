import { useMemo, useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { formatElapsed, useElapsed } from '../../../../shared/ui/elapsed'
import { subagentTasksFromMessages, type SubagentTaskStatus } from '../../lib/parts'
import { toolDescription } from '../../lib/toolMeta'
import { chatActions, useChatSession } from '../../store/chatStore'
import type { ToolCall } from '../../reducer/chatReducer'

// 서브에이전트(Task) 행의 상태별 접두 동사. 진행 중만 shimmer.
const PREFIX: Record<SubagentTaskStatus, string> = {
  running: '에이전트 실행 중',
  completed: '에이전트 완료',
  aborted: '에이전트 중지됨',
  failed: '에이전트 실패'
}

// 서브에이전트 Task 전용 행 — 일반 ToolCard 와 동일한 행 DOM/인터랙션(클릭 시 우측 패널)을
// 갖되, 라벨을 참고 UI 양식으로 구성한다. child 메타(모델·현재 도구·도구수·경과시간)는
// store 의 messages 에서 파생하므로 이 컴포넌트만 store 를 구독한다(일반 도구 카드는 비구독).
//
// 포맷(진행 중):
//  · 그룹 내: `에이전트 실행 중 {model} {title} {elapsed}`
//  · 단일:    `에이전트 실행 중 {model} · {현재 child 도구} · {child 도구수}`
// 완료/중지/실패: `에이전트 {상태} {model} {title}` (+ 완료 시 durationLabel).
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

  const status: SubagentTaskStatus = summary?.status ?? (call.result ? 'completed' : 'running')
  const running = status === 'running'
  // 진행 중 경과시간 앵커 — 이 행의 마운트 시각을 로컬에 기록한다(렌더러 전용, reducer/part
  // 비오염). lazy initializer 라 1회만 평가. 완료 상태로 마운트(세션 복원)되면 durationLabel 을
  // 쓰므로 이 값은 무관. 진행 중 마운트면 ≈ 서브에이전트 시작 시각.
  const [mountedAt] = useState(() => Date.now())
  const elapsedSec = useElapsed(running ? mountedAt : null)

  const model = summary?.agentLabel ?? '에이전트'
  const title = summary?.description ?? toolDescription(call)
  const isBad = status === 'failed'

  // 메타 문자열(접두 동사 우측). nbsp 가 아니라 일반 공백으로 단어 구분.
  let detail: string
  if (running && !inGroup) {
    const current = summary?.currentChildLabel ?? '…'
    const count = summary?.childToolCount ?? 0
    detail = `${model} · ${current} · ${count}`
  } else if (running) {
    const elapsed = elapsedSec > 0 ? ` ${formatElapsed(elapsedSec)}` : ''
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
