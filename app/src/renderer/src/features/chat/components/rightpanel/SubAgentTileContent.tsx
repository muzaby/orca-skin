import { Button } from '../../../../shared/ui/Button'
import { StatusLine } from '../../../../shared/ui/StatusLine'
import { AssistantMessage } from '../transcript/AssistantMessage'
import {
  childMessageForParentToolRunId,
  subagentTasksFromMessages,
  type SubagentTaskStatus
} from '../../lib/parts'
import { formatTimeFull, formatTimeShort } from '../../format'
import { chatActions, useChatSession, useSubagentMeta } from '../../store/chatStore'
import type { ToolCall } from '../../reducer/chatReducer'

const STATUS_LABEL: Record<SubagentTaskStatus, string> = {
  running: '진행 중',
  completed: '완료',
  failed: '실패',
  aborted: '중단됨'
}

// 목록은 상태별 그룹(진행 중 → 완료 → 중단됨 → 실패)으로 묶는다. 빈 그룹은 렌더하지 않는다.
const GROUP_ORDER: SubagentTaskStatus[] = ['running', 'completed', 'aborted', 'failed']

// 메타 라인의 항목 구분 — 가시 간격 유지를 위해 nbsp 2칸(이미지 양식).
const GAP = '  '

function promptFromCall(call: ToolCall): string | null {
  const input = call.input
  if (typeof input === 'object' && input !== null) {
    const prompt = (input as Record<string, unknown>).prompt
    if (typeof prompt === 'string' && prompt.trim() !== '') return prompt
  }
  return null
}

// Task 결과 output 에서 완료 답변 텍스트를 끌어낸다 — 문자열이면 그대로, 객체면 summary/message.
function answerTextFromCall(call: ToolCall): string | null {
  const output = call.result?.output
  if (output == null) return null
  if (typeof output === 'string') return output.trim() !== '' ? output : null
  if (typeof output === 'object') {
    const rec = output as Record<string, unknown>
    for (const key of ['summary', 'message', 'text']) {
      const v = rec[key]
      if (typeof v === 'string' && v.trim() !== '') return v
    }
  }
  return null
}

// 타일 헤더 콘텐츠 — 상세(Task 선택)면 뒤로가기 + Task 제목, 목록이면 '백그라운드 작업'.
// RightPanelTile 의 기본 라벨 span 을 대체한다(tileRegistry 주입). 제목 폰트/톤은 기본 라벨과 일치.
export function SubAgentTileHeader(): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  const selected = selectedId
    ? subagentTasksFromMessages(messages).find((task) => task.toolUseId === selectedId)
    : undefined

  if (selected) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-g1">
        <Button
          iconOnly
          size="small"
          leadingIcon="arrowL"
          onClick={() => chatActions.selectSubagentTask(null)}
          aria-label="목록으로"
        />
        <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
          {selected.description}
        </span>
      </div>
    )
  }
  return (
    <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
      백그라운드 작업
    </span>
  )
}

export function SubAgentTileContent(): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  const tasks = subagentTasksFromMessages(messages)
  const selected = selectedId ? tasks.find((task) => task.toolUseId === selectedId) : undefined
  const childMessage = selectedId ? childMessageForParentToolRunId(messages, selectedId) : null
  // 진행 중 서브에이전트 상세에서 메인 transcript 와 동일한 프로세싱 표시(StatusLine)를 버블
  // 아래에 띄우기 위한 경과 앵커 — 라이브 메타의 startedAtMs(첫 task 이벤트 수신 시각).
  const selectedMeta = useSubagentMeta(selectedId ?? '')

  // 상세 — Task 프롬프트(요청사항)는 사용자 메시지 버블처럼 우측 정렬, 그 아래 child
  // 트랜스크립트를 메인 transcript 컴포넌트로 렌더. 뒤로가기/제목은 타일 헤더가 담당.
  // 간격은 메인 transcript 양식을 따른다 — 프롬프트↔답변 사이 --chat-turn-gap(턴 간격).
  if (selected) {
    const prompt = promptFromCall(selected.call)
    // child 트랜스크립트에 실제 답변 텍스트가 없으면(예: 도구 없이 끝난 Task) Task 결과의
    // summary/message 를 완료 답변으로 폴백 렌더한다(완료됨 답변 출력 보장).
    const childHasText = childMessage?.parts.some((p) => p.type === 'text') ?? false
    const answerFallback = childHasText ? null : answerTextFromCall(selected.call)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-[var(--chat-turn-gap)] overflow-auto px-p5 py-p4">
        {prompt && (
          <div className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink">
              {prompt}
            </div>
          </div>
        )}
        {childMessage && <AssistantMessage message={childMessage} />}
        {answerFallback && (
          <div className="whitespace-pre-wrap text-[14px] leading-[1.7] text-ink">
            {answerFallback}
          </div>
        )}
        {/* 진행 중이면 메인 transcript 와 동일한 StatusLine 을 child 트랜스크립트 아래에 — 같은
            컴포넌트·인자(turnStartedAt)로 재사용해 "처리 중" 아이콘/경과를 동일하게 노출. */}
        {selected.status === 'running' && (
          <StatusLine turnStartedAt={selectedMeta?.startedAtMs ?? null} />
        )}
        {!childMessage && !answerFallback && (
          <div className="rounded-r5 border border-t5 bg-bg2 p-4 text-footnote text-ink3">
            이 작업에 기록된 하위 활동이 없습니다.
          </div>
        )}
      </div>
    )
  }

  // 목록 — 백그라운드 작업을 상태 그룹으로 묶어 카드로 표시한다(이미지 양식).
  if (tasks.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center">
          <p className="text-footnote font-medium text-t6">백그라운드 작업이 없습니다</p>
          <p className="text-caption text-ink3">Task 도구 호출이 감지되면 여기에 표시됩니다.</p>
        </div>
      </div>
    )
  }

  const groups = GROUP_ORDER.map((status) => ({
    status,
    items: tasks.filter((task) => task.status === status)
  })).filter((group) => group.items.length > 0)

  return (
    <div className="min-h-0 flex-1 overflow-auto px-p4 py-p4">
      {groups.map((group, gi) => (
        <div key={group.status} className={gi > 0 ? 'mt-5' : ''}>
          {/* 상태 그룹 헤더 — 상하 여백 확보(원본 이미지). */}
          <div className="mb-g3 mt-g1 flex items-center px-p2 text-footnote text-t6">
            <span>{STATUS_LABEL[group.status]}</span>
          </div>
          <div className="flex flex-col gap-g3">
            {group.items.map((task) => {
              const open = (): void => chatActions.selectSubagentTask(task.toolUseId)
              return (
                // 카드 전체가 대화록 열기 트리거. 내부에 중단 버튼(중첩 버튼 불가)을 두기 위해
                // <button> 대신 role="button" div 로 두고 키보드 동작을 유지한다.
                <div
                  key={task.toolUseId}
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      open()
                    }
                  }}
                  aria-label={`${task.description} 대화록 보기`}
                  className="group/subagent cursor-pointer rounded-r6 bg-bg2 px-3 py-2.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
                >
                  <div className="flex min-w-0 items-center gap-g3">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-t6" />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold text-t9">
                      {task.description}
                    </span>
                  </div>
                  <div className="mt-g1 pl-5 text-footnote text-ink3">
                    {`에이전트${GAP}${STATUS_LABEL[task.status]}`}
                    {task.durationLabel ? `${GAP}${task.durationLabel}` : ''}
                    <span title={formatTimeFull(task.createdAtMs)}>
                      {`${GAP}${formatTimeShort(task.createdAtMs)}`}
                    </span>
                  </div>
                  <div className="mt-g1 flex items-center pl-5 text-footnote text-ink3">
                    <span className="min-w-0 truncate">
                      {task.tokenLabel ? `${task.tokenLabel}${GAP}` : ''}
                      {task.toolCountLabel}
                      {GAP}
                      <span className="font-medium text-t7 group-hover/subagent:underline">
                        대화록 보기
                      </span>
                    </span>
                    {task.status === 'running' && (
                      // 진행 중 서브에이전트 중단 — 네모·라운드·채움없음(stop 아이콘). 카드 열기와
                      // 버블링 분리(stopPropagation). turn 전체가 아니라 이 Task 만 멈춘다.
                      // '대화록 보기' 바로 우측에 좌측정렬(ml-auto 로 끝까지 밀지 않음).
                      <Button
                        iconOnly
                        variant="uncontained"
                        size="small"
                        leadingIcon="stop"
                        aria-label="중단"
                        title="중단"
                        className="ml-g2 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          chatActions.stopSubagent(task.toolUseId)
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
