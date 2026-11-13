import { useMemo } from 'react'
import { SubAgentTaskDetail } from '../../common/rightpanel/SubAgentTaskDetail'
import { projectLegacyBackgroundPanel } from '../../../lib/canonicalBackground'
import { BackgroundCard } from '../../common/rightpanel/BackgroundCard'
import { BackgroundModelLabel } from '../../common/rightpanel/BackgroundModelLabel'
import { BackgroundTaskGroup } from '../../common/rightpanel/BackgroundTaskGroup'
import {
  dismissCompletedBackgroundItems,
  toggleBackgroundGroup,
  useBackgroundStore
} from '../../../store/backgroundStore'
import { Button } from '../../../../../shared/ui/Button'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import {
  childMessageForParentToolRunId,
  subagentTasksFromMessages,
  type SubagentTaskStatus,
  type SubagentTaskSummary
} from '../../../lib/parts'
import {
  backgroundBoardStatus,
  backgroundTaskKey,
  canBackgroundStatus,
  canStopBackgroundStatus
} from '../../../lib/taskBoard'
import { formatDurationLabel, formatTokenLabel, META_GAP } from '../../../lib/toolMeta'
import type { TFunction } from 'i18next'
import {
  formatTimeFull,
  formatTimeShort,
  useI18n,
  type MessageKey
} from '../../../../../shared/i18n'
import {
  chatActions,
  useBackgroundedTasks,
  useChatSession,
  useChatStore,
  usePausedTasks,
  useStoppingTasks,
  useSubagentMeta
} from '../../../store/chatStore'
import type { TaskStopError } from '../../../reducer/chatReducer'

// 백그라운드 타일의 **구 모델 표시** — 정본 상태(`backgroundStore.sessions`)가 없거나 비어 있는
// 세션에서 transcript 파트로 목록·상세·헤더를 그린다(0231 과거 표시 fallback). 어느 모델로 그릴지는
// `SubAgentTileContent.tsx` 가 고르고, 구 모델의 구독과 계산은 이 파일에서만 일어난다(0313).

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
  rejected: 'chat.subagentTile.status.rejected',
  cancelled: 'chat.subagentTile.status.cancelled',
  not_executed: 'chat.subagentTile.status.not_executed',
  aborted: 'chat.subagentTile.status.aborted'
}

// 0204 D-016a — 이 타일은 `72766d2` 의 표시(그룹·카드·상세)를 복구하되 **중단 수명주기는
// D-005/D-006 을 유지한다**: 클릭은 요청이고 확정은 SDK 정착이 준다. 그래서 `running` 이지만
// 중단 확정을 기다리는 동안은 '중단 중…' 을 보이고 버튼을 감춘다(중복 요청 차단).
// 복구가 "즉시 중단됨 확정" 으로 되돌아가는 것이 아니라는 점이 D-016a 의 요지다.

// 헤더 — 상세(Task 선택)면 뒤로가기 + Task 제목, 목록이면 '백그라운드 작업'.
// 제목 폰트/톤은 RightPanelTile 의 기본 라벨과 일치.
export function LegacySubAgentHeader(): React.JSX.Element {
  const { tr } = useI18n()
  const sessionId = useChatSession((s) => s.sessionId)
  const activeKey = useChatStore((s) => s.activeKey)
  const panel = useBackgroundStore((s) => s.panels[sessionId ?? activeKey])
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  // 요약은 메시지 배열당 한 번만 계산된다(`subagentTasksFromMessages`). 여기 메모는 거르기·찾기 몫이다.
  const selected = useMemo(
    () =>
      selectedId
        ? projectLegacyBackgroundPanel(subagentTasksFromMessages(messages), panel).find(
            (task) => task.toolUseId === selectedId
          )
        : undefined,
    [messages, selectedId, panel]
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

export function LegacySubAgentContent(): React.JSX.Element {
  const sessionId = useChatSession((s) => s.sessionId)
  const activeKey = useChatStore((s) => s.activeKey)
  const panel = useBackgroundStore((s) => s.panels[sessionId ?? activeKey])
  const messages = useChatSession((s) => s.messages)
  const transcriptPolicy = agentUiPolicy(useChatSession((s) => s.agentKind)).transcript
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
  // StatusLine 1s 틱 등 무관 재렌더마다 거르기를 되풀이하지 않는다.
  const tasks = useMemo(
    () => projectLegacyBackgroundPanel(subagentTasksFromMessages(messages), panel),
    [messages, panel]
  )
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
        transcriptPolicy={transcriptPolicy}
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

// 목록 — 백그라운드 작업을 상태 그룹으로 묶어 카드로 표시한다(`72766d2` 복구, D-016).
// **props 만 읽는 순수 View**.
export function SubAgentTaskList({
  tasks: allTasks,
  stoppingIds: stopping,
  pausedIds: paused = EMPTY_IDS,
  backgroundedIds: backgrounded = EMPTY_IDS,
  stopErrors
}: {
  tasks: readonly SubagentTaskSummary[]
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
  const sessionId = useChatSession((s) => s.sessionId)
  const activeKey = useChatStore((s) => s.activeKey)
  const panelKey = sessionId ?? activeKey
  const panel = useBackgroundStore((s) => s.panels[panelKey])
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  const tasks = projectLegacyBackgroundPanel(allTasks, panel)
  const clearCompleted = (): void => {
    dismissCompletedBackgroundItems(panelKey, tasks)
    if (tasks.some((task) => task.toolUseId === selectedId && task.status !== 'running'))
      chatActions.selectSubagentTask(null)
  }
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

  const groups = (['running', 'completed'] as const)
    .map((status) => ({
      status,
      items: tasks.filter((task) => (task.status === 'running') === (status === 'running'))
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="min-h-0 flex-1 overflow-auto px-p4 py-p4">
      {groups.map((group, gi) => (
        <div key={group.status} className={gi > 0 ? 'mt-5' : ''}>
          <BackgroundTaskGroup
            group={group.status}
            count={group.items.length}
            collapsed={panel?.collapsed?.[group.status] ?? false}
            onToggle={() => toggleBackgroundGroup(panelKey, group.status)}
            onClear={clearCompleted}
          >
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
                <BackgroundCard
                  key={task.toolUseId}
                  title={task.description}
                  ariaLabel={tr('chat.subagentTile.openTranscriptAria', {
                    description: task.description
                  })}
                  onOpen={open}
                >
                  <div className="mt-g1 pl-5 text-footnote text-ink3">
                    <BackgroundModelLabel
                      toolUseId={task.toolUseId}
                      persistedModel={task.call.result?.subagentMeta?.model}
                    />
                    {`${META_GAP}${
                      boardStatus === 'stopping'
                        ? tr('chat.subagentTile.status.stopping')
                        : boardStatus === 'paused'
                          ? tr('chat.subagentTile.status.paused')
                          : tr(STATUS_KEY[task.status])
                    }`}
                    {formatDurationLabel(tr, task.durationMs)
                      ? `${META_GAP}${formatDurationLabel(tr, task.durationMs)}`
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
                </BackgroundCard>
              )
            })}
          </BackgroundTaskGroup>
        </div>
      ))}
    </div>
  )
}
