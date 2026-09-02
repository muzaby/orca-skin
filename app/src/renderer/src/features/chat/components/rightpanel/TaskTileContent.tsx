import { useEffect, useMemo } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { StatusLine } from '../StatusLine'
import { AssistantMessage } from '../transcript/AssistantMessage'
import { UserBubbleText } from '../UserBubbleText'
import { TaskStatusIcon } from './TaskStatusIcon'
import { childMessageForParentToolRunId } from '../../lib/parts'
import {
  canBackgroundTask,
  canStopTask,
  taskBoardFromMessages,
  taskBoardItemByKey,
  taskBoardOrdered,
  taskDetailRows,
  type TaskBoardItem,
  type TaskBoardStatus,
  type TaskDetailValue
} from '../../lib/taskBoard'
import { SectionPlaceholder, TileSection } from './TaskTileSections'
import { formatDurationLabel, formatTokenLabel, META_GAP } from '../../lib/toolMeta'
import type { TFunction } from 'i18next'
import type { TaskStopError } from '../../reducer/chatReducer'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import {
  chatActions,
  useBackgroundedTasks,
  useChatSession,
  usePausedTasks,
  useStoppingTasks,
  useSubagentMeta,
  useUnseenSettledTaskCount
} from '../../store/chatStore'

// 상태/그룹 라벨 키 — 렌더에서 tr() 해석(0096 stale-방지 패턴).
const STATUS_KEY: Record<TaskBoardStatus, MessageKey> = {
  in_progress: 'chat.taskTile.status.in_progress',
  stopping: 'chat.taskTile.status.stopping',
  paused: 'chat.taskTile.status.paused',
  pending: 'chat.taskTile.status.pending',
  completed: 'chat.taskTile.status.completed',
  aborted: 'chat.taskTile.status.aborted',
  failed: 'chat.taskTile.status.failed'
}

// 현재 세션의 작업 목록. 중단 대기 집합이 바뀌면 재계산해야 '중단 중' 표시가 갱신된다 —
// 의존성에서 빠뜨리면 클릭이 화면에 반영되지 않는다(0204 §14).
// fold 에 실을 라이브 표식 3종(0212) — 중단 대기 · 일시정지 · 이미/전환중 background.
// 두 fold 호출부(목록·헤더)가 같은 입력을 보게 한 곳에서 모은다: 한쪽만 인자를 늘리면 같은
// 항목이 화면마다 다른 상태로 보인다.
function useBoardTransients(): {
  stoppingBackgroundIds: ReadonlySet<string>
  pausedBackgroundIds: ReadonlySet<string>
  backgroundedIds: ReadonlySet<string>
} {
  const stoppingBackgroundIds = useStoppingTasks()
  const pausedBackgroundIds = usePausedTasks()
  const backgroundedIds = useBackgroundedTasks()
  return useMemo(
    () => ({ stoppingBackgroundIds, pausedBackgroundIds, backgroundedIds }),
    [stoppingBackgroundIds, pausedBackgroundIds, backgroundedIds]
  )
}

function useTaskBoard(): TaskBoardItem[] {
  const messages = useChatSession((s) => s.messages)
  const transients = useBoardTransients()
  // 순서는 `taskBoardOrdered` 하나가 정한다(§10 EP-14) — 컴포넌트가 다시 정렬하지 않는다.
  return useMemo(
    () => taskBoardOrdered(taskBoardFromMessages(messages, transients)),
    [messages, transients]
  )
}

// 헤더 전용 — 선택이 없으면 **접지 않는다**. 헤더는 그때 고정 문자열만 그리므로 전체 fold 가
// 통째로 버려진다(`SubAgentTileHeader` 가 같은 이유로 같은 가드를 둔다).
function useSelectedTaskForHeader(): TaskBoardItem | undefined {
  const messages = useChatSession((s) => s.messages)
  const transients = useBoardTransients()
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  return useMemo(
    () =>
      selectedKey
        ? taskBoardItemByKey(taskBoardFromMessages(messages, transients), selectedKey)
        : undefined,
    [messages, transients, selectedKey]
  )
}

// 타일 헤더 — 상세면 뒤로가기 + 작업 제목, 목록이면 '작업'. RightPanelTile 의 기본 라벨 span 을
// 대체한다(tileRegistry 주입). 제목 폰트/톤은 기본 라벨과 일치.
export function TaskTileHeader(): React.JSX.Element {
  const { tr } = useI18n()
  const selected = useSelectedTaskForHeader()

  if (selected) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-g1">
        <Button
          iconOnly
          size="small"
          leadingIcon="arrowL"
          onClick={() => chatActions.selectTask(null)}
          aria-label={tr('chat.taskTile.backToList')}
        />
        <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
          {selected.subject}
        </span>
      </div>
    )
  }
  return (
    <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
      {tr('chat.taskTile.headerTitle')}
    </span>
  )
}

function detailValueText(tr: TFunction, value: TaskDetailValue): string {
  switch (value.kind) {
    case 'statusLabel':
      return tr(STATUS_KEY[value.status])
    case 'text':
      return value.text
    case 'durationMs':
      return formatDurationLabel(tr, value.ms) ?? '—'
    case 'count':
      return String(value.count)
    case 'taskIds':
      return tr('chat.taskTile.blockedByValue', { ids: value.ids.join(', #') })
  }
}

// background 항목의 두 번째 메타 줄 — `background · 01:32 · 24 도구 사용`.
function backgroundMetaLine(tr: TFunction, item: TaskBoardItem): string {
  const meta = item.background
  if (!meta) return tr(STATUS_KEY[item.status])
  const pieces = [tr('chat.taskTile.backgroundBadge')]
  const duration = formatDurationLabel(tr, meta.durationMs)
  if (duration) pieces.push(duration)
  const tokens = formatTokenLabel(tr, meta.tokenCount)
  if (tokens) pieces.push(tokens)
  pieces.push(tr('chat.toolMeta.toolUses', { count: meta.toolUses }))
  if (item.status === 'stopping') pieces.push(tr(STATUS_KEY.stopping))
  // 중단도 사유를 말한다 — 이 분기는 `settlementMessage` 를 버리고 "사용자에 의해 중단됨" 을
  // 고정으로 썼다. SDK `task_updated` 의 `killed`(0212 AT-21)는 **사용자가 멈춘 것이 아니라서**
  // 그 문구가 사실도 틀린다. `failed` 분기와 대칭으로 생산자 문장을 우선한다(0204 D-024).
  if (item.status === 'aborted') {
    pieces.push(meta.settlementMessage ?? tr('chat.taskTile.stoppedReason'))
  }
  // 실패도 사유를 말한다(0204 D-024) — `aborted` 분기와 대칭. 정착 생산자가 실은 사람용 문장을
  // 그대로 쓰고, 없을 때만 일반 문구로 떨어진다.
  if (item.status === 'failed') {
    pieces.push(meta.settlementMessage ?? tr('chat.taskTile.failedReason'))
  }
  return pieces.join(META_GAP)
}

// 실패 문구는 여기서 조립한다 — 상태에는 카탈로그 키와 원문만 산다(0096 stale-방지).
function stopErrorText(tr: TFunction, err: TaskStopError): string {
  const base = tr(err.messageKey)
  return err.detail ? `${base} — ${err.detail}` : base
}

interface TaskRowProps {
  item: TaskBoardItem
  stopError?: TaskStopError
}

function TaskRow({ item, stopError }: TaskRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const open = (): void => chatActions.selectTask(item.key)
  // 카드 전체가 상세 열기 트리거. 내부에 중단 버튼(중첩 버튼 불가)을 두기 위해 <button> 대신
  // role="button" div 로 두고 키보드 동작을 유지한다.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      /* aria-label 은 **안정 이름**(subject)이다 — 표시 제목은 `in_progress` 동안 현재진행형으로
         바뀌므로(0212 D-006), 라벨까지 따라가면 스크린리더 사용자가 같은 항목을 다른 항목으로
         읽는다(D-007 · §10 EP-05). */
      aria-label={tr('chat.taskTile.openDetailAria', { description: item.subject })}
      className="group/task cursor-pointer rounded-r6 px-p2 py-1.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
    >
      {/* 제목 행 — 아이콘 · 제목 · (background 진행 중이면) 중단 버튼. 제목에 `flex-1` 을 주지
          않는 것이 D-020 의 요지다: flex-1 이면 남는 폭을 제목이 다 먹어 버튼이 행 우측 끝으로
          밀린다. `min-w-0 truncate` 만 주면 제목은 필요한 만큼만 차지하고 버튼이 **바로 뒤**에
          붙으며, 제목이 길면 잘리면서도 버튼 자리를 밀어내지 않는다. */}
      <div className="flex min-w-0 items-start gap-g2">
        {item.status === 'pending' ? (
          <TaskStatusIcon status="pending" badge={item.id} />
        ) : (
          <TaskStatusIcon status={item.status} />
        )}
        <span
          className={`min-w-0 truncate text-body leading-[1.5] ${
            item.status === 'completed' ? 'text-t6 line-through' : 'font-medium text-t9'
          }`}
        >
          {item.title}
        </span>
        {canBackgroundTask(item) && (
          // foreground → background 전환(0212 R-07) — 중단 **왼쪽**에 둔다: 파괴적이지 않은
          // 행위가 먼저 오고, 두 버튼이 나란히 서므로 문구가 구분의 유일한 수단이다(툴팁이
          // "작업은 계속 실행됩니다" 를 말한다). 서브에이전트는 기본이 background 라 이 버튼은
          // 대개 보이지 않는다 — 보이지 않는 것이 정상이다(D-021).
          <Button
            iconOnly
            variant="uncontained"
            size="small"
            leadingIcon="arrowR"
            aria-label={tr('chat.taskTile.toBackgroundAria', { description: item.subject })}
            title={tr('chat.taskTile.toBackgroundTitle')}
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              chatActions.backgroundTask(item.id)
            }}
          />
        )}
        {canStopTask(item) && (
          // 진행 중 background 작업 중단 — turn 전체가 아니라 이 작업만 멈춘다. 카드 열기와
          // 버블링 분리(stopPropagation). `paused` 행에서도 유지된다 — SDK 에 resume 이 없어
          // 여기가 유일한 탈출구다(0212 D-022).
          <Button
            iconOnly
            variant="uncontained"
            size="small"
            leadingIcon="stop"
            aria-label={tr('common.stop')}
            title={tr('common.stop')}
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              chatActions.stopTask(item.id)
            }}
          />
        )}
      </div>
      {item.background && (
        <div className="mt-0.5 truncate pl-6 text-footnote text-ink3">
          {backgroundMetaLine(tr, item)}
        </div>
      )}
      {stopError && (
        <div className="mt-0.5 pl-6 text-footnote text-bad">{stopErrorText(tr, stopError)}</div>
      )}
    </div>
  )
}

// `진행 상황` 섹션 본문 — **props 만 읽는 순수 View**. store 를 읽지 않으므로
// `renderToStaticMarkup` 으로 직접 검증할 수 있다(zustand 는 SSR 에서 `getInitialState()` 를
// 돌려주기 때문에 store 연결 컴포넌트는 시드가 반영되지 않는다). 0203 의 `...View` 선례와 동형.
export function TaskProgressList({
  items,
  stopErrors = {},
  agentTools = null,
  cliVersion = null
}: {
  items: TaskBoardItem[]
  stopErrors?: Record<string, TaskStopError>
  // SDK `init` 이 실은 노출 도구 전량 / CLI 버전(0212 R-01). **`null` 은 판정 불가**다 —
  // 도구 이름 배열이 안 왔다는 뜻이고, 그때는 안내하지 않는다(D-005).
  agentTools?: string[] | null
  cliVersion?: string | null
}): React.JSX.Element {
  const { tr } = useI18n()
  if (items.length === 0) {
    // 빈 상태는 세 갈래다(§10 EP-01). 기능이 **없다고 판정된 경우에만** 원인을 말한다 —
    // 판정 불가(agentTools === null)에 안내를 띄우면 멀쩡한 CLI 를 의심하게 된다.
    const unsupported = agentTools !== null && !agentTools.includes('TaskCreate')
    if (unsupported) {
      return (
        <div className="px-p2 text-caption text-ink3">
          <p>{tr('chat.taskTile.unsupported')}</p>
          {cliVersion && <p>{tr('chat.taskTile.unsupportedVersion', { version: cliVersion })}</p>}
        </div>
      )
    }
    return <p className="px-p2 text-caption text-ink3">{tr('chat.taskTile.emptyDesc')}</p>
  }
  // 상태 그룹 없이 한 줄로 나열한다(D-018) — 순서는 `taskBoardOrdered` 가 정하고 완료 항목은
  // 그룹으로 옮겨가지 않고 제자리에서 취소선으로 표시된다.
  return (
    <div className="flex flex-col gap-px">
      {items.map((item) => (
        <TaskRow key={item.key} item={item} stopError={stopErrors[item.key]} />
      ))}
    </div>
  )
}

function TaskDetail({ item }: { item: TaskBoardItem }): React.JSX.Element {
  const { tr } = useI18n()
  const messages = useChatSession((s) => s.messages)
  const meta = useSubagentMeta(item.kind === 'background' ? item.id : '')
  // 전체 parts 순회 + 매 렌더 새 Message 객체 — 메모하지 않으면 `AssistantMessage` 의 memo 가
  // 매번 깨진다. `subagent.task` 진행 이벤트는 `messages` 를 건드리지 않은 채 이 컴포넌트를
  // 다시 그리므로 그 재계산이 그대로 반복된다.
  const childMessage = useMemo(
    () => (item.kind === 'background' ? childMessageForParentToolRunId(messages, item.id) : null),
    [messages, item.kind, item.id]
  )
  // 프롬프트는 파생이 이미 뽑아 뒀다(taskBoard `backgroundItem`) — 상세가 transcript 를 다시
  // 훑지 않는다.
  const prompt = item.background?.prompt ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-g4 overflow-auto px-p5 py-p4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-footnote">
        {taskDetailRows(item).map((row) => (
          <div key={row.labelKey} className="contents">
            <dt className="text-ink3">{tr(row.labelKey)}</dt>
            <dd className="min-w-0 break-words text-t9">{detailValueText(tr, row.value)}</dd>
          </div>
        ))}
      </dl>

      {item.kind === 'background' && (
        <div className="flex min-h-0 flex-col gap-[var(--chat-turn-gap)]">
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
          {/* 진행 중이면 메인 transcript 와 동일한 StatusLine 을 아래에 — 같은 컴포넌트·인자로
              재사용해 "처리 중" 아이콘/경과를 동일하게 노출. */}
          {(item.status === 'in_progress' || item.status === 'stopping') && (
            <StatusLine turnStartedAt={meta?.startedAtMs ?? null} />
          )}
          {!childMessage && !prompt && (
            <div className="rounded-r5 border border-t5 bg-bg2 p-4 text-footnote text-ink3">
              {tr('chat.taskTile.noChildActivity')}
            </div>
          )}
        </div>
      )}

      {canBackgroundTask(item) && (
        <Button
          variant="uncontained"
          size="small"
          leadingIcon="arrowR"
          className="self-start"
          title={tr('chat.taskTile.toBackgroundTitle')}
          onClick={() => chatActions.backgroundTask(item.id)}
        >
          {tr('chat.taskTile.toBackground')}
        </Button>
      )}
      {canStopTask(item) && (
        <Button
          variant="uncontained"
          size="small"
          leadingIcon="stop"
          className="self-start"
          onClick={() => chatActions.stopTask(item.id)}
        >
          {tr('common.stop')}
        </Button>
      )}
    </div>
  )
}

export function TaskTileContent(): React.JSX.Element {
  const items = useTaskBoard()
  // 선택 항목은 이미 접은 목록에서 찾는다 — 별도 훅으로 부르면 같은 렌더에서 fold 가 한 번 더
  // 돈다(목록은 세션 전체 parts 순회다).
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  const selected = taskBoardItemByKey(items, selectedKey)
  const stopErrors = useChatSession((s) => s.taskStopErrors)
  const agentTools = useChatSession((s) => s.agentTools)
  const cliVersion = useChatSession((s) => s.cliVersion)
  // 타일이 화면에 있으면 사용자가 결과를 본 것이다 — 미확인 배지를 계속 비운다(0204 D-004).
  const unseen = useUnseenSettledTaskCount()
  useEffect(() => {
    if (unseen > 0) chatActions.acknowledgeSettledTasks()
  }, [unseen])

  if (selected) return <TaskDetail item={selected} />

  // cowork 우측 패널 양식(0204 D-017) — 한 카드 안에 접히는 세 섹션. `진행 상황` 만 데이터를
  // 갖고, 나머지 둘은 이번 라운드에 빈 상태다(D-022).
  return (
    <div className="min-h-0 flex-1 overflow-auto px-p3 py-p2">
      <TileSection titleKey="chat.taskTile.sections.progress">
        <TaskProgressList
          items={items}
          stopErrors={stopErrors}
          agentTools={agentTools}
          cliVersion={cliVersion}
        />
      </TileSection>
      <TileSection titleKey="chat.taskTile.sections.output">
        <SectionPlaceholder icon="chart" descKey="chat.taskTile.sections.outputDesc" />
      </TileSection>
      <TileSection titleKey="chat.taskTile.sections.context">
        <SectionPlaceholder icon="board" descKey="chat.taskTile.sections.contextDesc" />
      </TileSection>
    </div>
  )
}
