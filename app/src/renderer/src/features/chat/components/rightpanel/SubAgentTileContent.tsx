import { useMemo } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { StatusLine } from '../StatusLine'
import { AssistantMessage } from '../transcript/AssistantMessage'
import { UserBubbleText } from '../UserBubbleText'
import {
  childMessageForParentToolRunId,
  promptFromCall,
  subagentTasksFromMessages,
  type SubagentTaskStatus,
  type SubagentTaskSummary
} from '../../lib/parts'
import {
  backgroundBoardStatus,
  backgroundTaskKey,
  canBackgroundStatus,
  canStopBackgroundStatus
} from '../../lib/taskBoard'
import { formatDurationLabel, formatTokenLabel, META_GAP } from '../../lib/toolMeta'
import type { TFunction } from 'i18next'
import { formatTimeFull, formatTimeShort, useI18n, type MessageKey } from '../../../../shared/i18n'
import {
  chatActions,
  useBackgroundedTasks,
  useChatSession,
  usePausedTasks,
  useStoppingTasks,
  useSubagentMeta
} from '../../store/chatStore'
import type { Message, TaskStopError, ToolCall } from '../../reducer/chatReducer'

// 중단 실패 문구 조립 — 상태에는 카탈로그 키와 원문만 산다(0096 stale-방지 패턴).
function stopErrorText(tr: TFunction, err: TaskStopError): string {
  const base = tr(err.messageKey)
  return err.detail ? `${base} — ${err.detail}` : base
}

// 기본 인자용 불변 빈 집합 — 매 렌더 새 Set 이면 하위 메모가 죽는다.
const EMPTY_IDS: ReadonlySet<string> = new Set()

// 상태 라벨 키 — 렌더에서 tr() 해석(0096 stale-방지 패턴).
const STATUS_KEY: Record<SubagentTaskStatus, MessageKey> = {
  running: 'chat.subagentTile.status.running',
  completed: 'chat.subagentTile.status.completed',
  failed: 'chat.subagentTile.status.failed',
  aborted: 'chat.subagentTile.status.aborted'
}

// 목록은 상태별 그룹(진행 중 → 완료 → 중단됨 → 실패)으로 묶는다. 빈 그룹은 렌더하지 않는다.
const GROUP_ORDER: SubagentTaskStatus[] = ['running', 'completed', 'aborted', 'failed']

// 0204 D-016a — 이 타일은 `72766d2` 의 표시(그룹·카드·상세)를 복구하되 **중단 수명주기는
// D-005/D-006 을 유지한다**: 클릭은 요청이고 확정은 SDK 정착이 준다. 그래서 `running` 이지만
// 중단 확정을 기다리는 동안은 '중단 중…' 을 보이고 버튼을 감춘다(중복 요청 차단).
// 복구가 "즉시 중단됨 확정" 으로 되돌아가는 것이 아니라는 점이 D-016a 의 요지다.

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
  const { tr } = useI18n()
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  // O(전체 parts) 파생이라 메모 — messages identity 는 커밋 이벤트에만 바뀐다 (AgentTaskRow 동일).
  const selected = useMemo(
    () =>
      selectedId
        ? subagentTasksFromMessages(messages).find((task) => task.toolUseId === selectedId)
        : undefined,
    [messages, selectedId]
  )

  if (selected) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-g1">
        <Button
          iconOnly
          size="small"
          leadingIcon="arrowL"
          onClick={() => chatActions.selectSubagentTask(null)}
          aria-label={tr('chat.subagentTile.backToList')}
        />
        <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
          {selected.description}
        </span>
      </div>
    )
  }
  return (
    <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
      {tr('chat.subagentTile.headerTitle')}
    </span>
  )
}

export function SubAgentTileContent(): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  // 중단 요청을 보내고 SDK 확정을 기다리는 집합(D-005). 표시에만 쓰고 상태를 확정하지 않는다.
  const stopping = useStoppingTasks()
  // 두 타일이 같은 라이브 표식을 본다(0212 §10 EP-10·EP-12) — 한쪽만 인자를 늘리면 같은 항목이
  // 화면마다 다른 상태·다른 제어를 갖는다.
  const paused = usePausedTasks()
  const backgrounded = useBackgroundedTasks()
  // 중단 실패 문구(0215 D-017). 이 문구는 `작업` 타일이 그리던 것인데 그 타일에서 서브에이전트가
  // 빠지면서 렌더 지점이 0곳이 됐다 — 중단을 누르는 자리로 함께 옮긴다. 옮기지 않으면 실패가
  // 화면에서 "아무 일도 안 일어남" 으로 보인다.
  const stopErrors = useChatSession((s) => s.taskStopErrors)
  // O(전체 parts) 파생이라 메모 — StatusLine 1s 틱 등 무관 재렌더마다 재계산하지 않는다.
  const tasks = useMemo(() => subagentTasksFromMessages(messages), [messages])
  const selected = selectedId ? tasks.find((task) => task.toolUseId === selectedId) : undefined
  const childMessage = selectedId ? childMessageForParentToolRunId(messages, selectedId) : null
  // 진행 중 서브에이전트 상세에서 메인 transcript 와 동일한 프로세싱 표시(StatusLine)를 버블
  // 아래에 띄우기 위한 경과 앵커 — 라이브 메타의 startedAtMs(첫 task 이벤트 수신 시각).
  const selectedMeta = useSubagentMeta(selectedId ?? '')

  if (selected) {
    return (
      <SubAgentTaskDetail
        task={selected}
        childMessage={childMessage}
        startedAtMs={selectedMeta?.startedAtMs ?? null}
      />
    )
  }

  return (
    <SubAgentTaskList
      tasks={tasks}
      stoppingIds={stopping}
      pausedIds={paused}
      backgroundedIds={backgrounded}
      stopErrors={stopErrors}
    />
  )
}

// 상세 — Task 프롬프트(요청사항)는 사용자 메시지 버블처럼 우측 정렬, 그 아래 child
// 트랜스크립트를 메인 transcript 컴포넌트로 렌더. 뒤로가기/제목은 타일 헤더가 담당.
// 간격은 메인 transcript 양식을 따른다 — 프롬프트↔답변 사이 --chat-turn-gap(턴 간격).
//
// **props 만 읽는 순수 View** — store 를 읽지 않아 `renderToStaticMarkup` 으로 검증할 수 있다.
export function SubAgentTaskDetail({
  task: selected,
  childMessage,
  startedAtMs
}: {
  task: SubagentTaskSummary
  childMessage: Message | null
  startedAtMs: number | null
}): React.JSX.Element {
  const { tr } = useI18n()
  const prompt = promptFromCall(selected.call)
  // child 트랜스크립트에 실제 답변 텍스트가 없으면(예: 도구 없이 끝난 Task) Task 결과의
  // summary/message 를 완료 답변으로 폴백 렌더한다(완료됨 답변 출력 보장).
  const childHasText = childMessage?.parts.some((p) => p.type === 'text') ?? false
  const answerFallback = childHasText ? null : answerTextFromCall(selected.call)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--chat-turn-gap)] overflow-auto px-p5 py-p4">
      {prompt && (
        <div className="flex justify-end">
          <UserBubbleText
            className="max-w-[85%] rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink"
            title={prompt}
          >
            {prompt}
          </UserBubbleText>
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
      {selected.status === 'running' && <StatusLine turnStartedAt={startedAtMs} />}
      {!childMessage && !answerFallback && (
        <div className="rounded-r5 border border-t5 bg-bg2 p-4 text-footnote text-ink3">
          {tr('chat.subagentTile.noChildActivity')}
        </div>
      )}
    </div>
  )
}

// 목록 — 백그라운드 작업을 상태 그룹으로 묶어 카드로 표시한다(`72766d2` 복구, D-016).
// **props 만 읽는 순수 View** — 위와 같은 이유.
export function SubAgentTaskList({
  tasks,
  stoppingIds: stopping,
  pausedIds: paused = EMPTY_IDS,
  backgroundedIds: backgrounded = EMPTY_IDS,
  stopErrors
}: {
  tasks: SubagentTaskSummary[]
  stoppingIds: ReadonlySet<string>
  // 0212 — SDK 가 `paused` 로 말한 집합 / 이미(또는 전환 중) background 인 집합. 기본값을 둬서
  // 기존 렌더 테스트가 인자를 늘리지 않고도 그대로 돈다.
  pausedIds?: ReadonlySet<string>
  backgroundedIds?: ReadonlySet<string>
  // 0215 D-017 — 중단 실패 문구. 키는 `bg:<toolUseId>`(reducer 가 그 형식으로 쓴다).
  // D-019 로 **필수** — 빈 객체 기본값은 배선 누락과 "실패 없음" 을 구분하지 못한다.
  stopErrors: Record<string, TaskStopError>
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  if (tasks.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center">
          <p className="text-footnote font-medium text-t6">{tr('chat.subagentTile.emptyTitle')}</p>
          <p className="text-caption text-ink3">{tr('chat.subagentTile.emptyDesc')}</p>
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
            <span>{tr(STATUS_KEY[group.status])}</span>
          </div>
          <div className="flex flex-col gap-g3">
            {group.items.map((task) => {
              const open = (): void => chatActions.selectSubagentTask(task.toolUseId)
              // 중단 대기 → 표시 상태의 규칙은 `taskBoard` 가 소유한다(plan §3 갱신메모) —
              // 두 타일이 같은 수명주기를 각자의 인라인 조건으로 쓰면 한쪽만 따라간다.
              const boardStatus = backgroundBoardStatus(
                task.status,
                task.toolUseId,
                stopping,
                paused
              )
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
                  aria-label={tr('chat.subagentTile.openTranscriptAria', {
                    description: task.description
                  })}
                  className="group/subagent cursor-pointer rounded-r6 bg-bg2 px-3 py-2.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
                >
                  <div className="flex min-w-0 items-center gap-g3">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-t6" />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold text-t9">
                      {task.description}
                    </span>
                  </div>
                  <div className="mt-g1 pl-5 text-footnote text-ink3">
                    {`${tr('chat.toolMeta.agentFallback')}${META_GAP}${
                      boardStatus === 'stopping'
                        ? tr('chat.subagentTile.status.stopping')
                        : boardStatus === 'paused'
                          ? tr('chat.subagentTile.status.paused')
                          : tr(STATUS_KEY[task.status])
                    }`}
                    {formatDurationLabel(tr, task.durationMs)
                      ? `${META_GAP}${formatDurationLabel(tr, task.durationMs)}`
                      : ''}
                    {/* 정착 사유 — 생산자가 실은 사람용 문장을 그대로 쓴다(0204 D-024). 0215
                        이전에는 `작업` 타일이 유일 렌더 지점이었고, 그 타일에서 서브에이전트가
                        빠지면서 소비자가 0곳이 됐다(D-017 과 같은 축). */}
                    {task.settlementMessage
                      ? `${META_GAP}${task.settlementMessage}`
                      : task.status === 'aborted'
                        ? `${META_GAP}${tr('chat.taskTile.stoppedReason')}`
                        : task.status === 'failed'
                          ? `${META_GAP}${tr('chat.taskTile.failedReason')}`
                          : ''}
                    <span title={formatTimeFull(task.createdAtMs, locale)}>
                      {`${META_GAP}${formatTimeShort(task.createdAtMs, locale)}`}
                    </span>
                  </div>
                  <div className="mt-g1 flex items-center pl-5 text-footnote text-ink3">
                    <span className="min-w-0 truncate">
                      {formatTokenLabel(tr, task.tokenCount)
                        ? `${formatTokenLabel(tr, task.tokenCount)}${META_GAP}`
                        : ''}
                      {tr('chat.toolMeta.toolUses', { count: task.childToolCount })}
                      {META_GAP}
                      <span className="font-medium text-t7 group-hover/subagent:underline">
                        {tr('chat.subagentTile.viewTranscript')}
                      </span>
                    </span>
                    {canBackgroundStatus(
                      boardStatus,
                      task.asyncLaunched || backgrounded.has(task.toolUseId)
                    ) && (
                      // foreground → background 전환(0212 R-07) — 중단과 같은 자리에 나란히
                      // 붙는다. `작업` 타일과 **같은 술어**를 쓴다(§10 EP-12).
                      <Button
                        iconOnly
                        variant="uncontained"
                        size="small"
                        leadingIcon="arrowR"
                        aria-label={tr('chat.taskTile.toBackgroundAria', {
                          description: task.description
                        })}
                        title={tr('chat.taskTile.toBackgroundTitle')}
                        className="ml-g2 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          chatActions.backgroundTask(task.toolUseId)
                        }}
                      />
                    )}
                    {canStopBackgroundStatus(boardStatus) && (
                      // 진행 중 서브에이전트 중단 — 네모·라운드·채움없음(stop 아이콘). 카드 열기와
                      // 버블링 분리(stopPropagation). turn 전체가 아니라 이 Task 만 멈춘다.
                      // '대화록 보기' 바로 우측에 좌측정렬(ml-auto 로 끝까지 밀지 않음) — 이 자리가
                      // `72766d2` 복구 대상이다(D-016). 제목 우측 배치는 `작업` 타일 쪽이다(D-020).
                      <Button
                        iconOnly
                        variant="uncontained"
                        size="small"
                        leadingIcon="stop"
                        aria-label={tr('common.stop')}
                        title={tr('common.stop')}
                        className="ml-g2 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          chatActions.stopTask(task.toolUseId)
                        }}
                      />
                    )}
                  </div>
                  {stopErrors[backgroundTaskKey(task.toolUseId)] && (
                    <div className="mt-0.5 text-footnote text-bad">
                      {stopErrorText(tr, stopErrors[backgroundTaskKey(task.toolUseId)]!)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
