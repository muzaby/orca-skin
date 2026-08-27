import { useEffect, useMemo } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { StatusLine } from '../StatusLine'
import { AssistantMessage } from '../transcript/AssistantMessage'
import { UserBubbleText } from '../UserBubbleText'
import { TaskStatusIcon } from './TaskStatusIcon'
import { childMessageForParentToolRunId, partsToolCalls } from '../../lib/parts'
import {
  canStopTask,
  taskBoardFromMessages,
  taskBoardItemByKey,
  taskBoardOrdered,
  taskDetailRows,
  type TaskBoardItem,
  type TaskBoardStatus,
  type TaskDetailValue
} from '../../lib/taskBoard'
import { ContextSectionEmpty, OutputSectionEmpty, TileSection } from './TaskTileSections'
import { formatDurationLabel, formatTokenLabel } from '../../lib/toolMeta'
import type { TFunction } from 'i18next'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import {
  chatActions,
  useChatSession,
  useStoppingTasks,
  useSubagentMeta,
  useUnseenSettledTaskCount
} from '../../store/chatStore'

// 상태/그룹 라벨 키 — 렌더에서 tr() 해석(0096 stale-방지 패턴).
const STATUS_KEY: Record<TaskBoardStatus, MessageKey> = {
  in_progress: 'chat.taskTile.status.in_progress',
  stopping: 'chat.taskTile.status.stopping',
  pending: 'chat.taskTile.status.pending',
  completed: 'chat.taskTile.status.completed',
  aborted: 'chat.taskTile.status.aborted',
  failed: 'chat.taskTile.status.failed'
}

// 메타 라인의 항목 구분 — 가시 간격 유지를 위해 nbsp 2칸(기존 백그라운드 목록과 동일 양식).
const GAP = '  '

// 현재 세션의 작업 목록. 중단 대기 집합이 바뀌면 재계산해야 '중단 중' 표시가 갱신된다 —
// 의존성에서 빠뜨리면 클릭이 화면에 반영되지 않는다(0204 §14).
function useTaskBoard(): TaskBoardItem[] {
  const messages = useChatSession((s) => s.messages)
  const stopping = useStoppingTasks()
  // 순서는 `taskBoardOrdered` 하나가 정한다(§10 EP-14) — 컴포넌트가 다시 정렬하지 않는다.
  return useMemo(
    () => taskBoardOrdered(taskBoardFromMessages(messages, { stoppingBackgroundIds: stopping })),
    [messages, stopping]
  )
}

function useSelectedTask(): TaskBoardItem | undefined {
  const items = useTaskBoard()
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  return taskBoardItemByKey(items, selectedKey)
}

// 타일 헤더 — 상세면 뒤로가기 + 작업 제목, 목록이면 '작업'. RightPanelTile 의 기본 라벨 span 을
// 대체한다(tileRegistry 주입). 제목 폰트/톤은 기본 라벨과 일치.
export function TaskTileHeader(): React.JSX.Element {
  const { tr } = useI18n()
  const selected = useSelectedTask()

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
          {selected.title}
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
  if (item.status === 'aborted') pieces.push(tr('chat.taskTile.stoppedReason'))
  // 실패도 사유를 말한다(0204 D-024) — `aborted` 분기와 대칭. 정착 생산자가 실은 사람용 문장을
  // 그대로 쓰고, 없을 때만 일반 문구로 떨어진다.
  if (item.status === 'failed') {
    pieces.push(meta.settlementMessage ?? tr('chat.taskTile.failedReason'))
  }
  return pieces.join(GAP)
}

interface TaskRowProps {
  item: TaskBoardItem
  stopError?: string
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
      aria-label={tr('chat.taskTile.openDetailAria', { description: item.title })}
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
        {canStopTask(item) && (
          // 진행 중 background 작업 중단 — turn 전체가 아니라 이 작업만 멈춘다. 카드 열기와
          // 버블링 분리(stopPropagation).
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
              chatActions.stopTask(item.key)
            }}
          />
        )}
      </div>
      {item.background && (
        <div className="mt-0.5 truncate pl-6 text-footnote text-ink3">
          {backgroundMetaLine(tr, item)}
        </div>
      )}
      {stopError && <div className="mt-0.5 pl-6 text-footnote text-bad">{stopError}</div>}
    </div>
  )
}

// `진행 상황` 섹션 본문 — **props 만 읽는 순수 View**. store 를 읽지 않으므로
// `renderToStaticMarkup` 으로 직접 검증할 수 있다(zustand 는 SSR 에서 `getInitialState()` 를
// 돌려주기 때문에 store 연결 컴포넌트는 시드가 반영되지 않는다). 0203 의 `...View` 선례와 동형.
export function TaskProgressList({
  items,
  stopErrors = {}
}: {
  items: TaskBoardItem[]
  stopErrors?: Record<string, string>
}): React.JSX.Element {
  const { tr } = useI18n()
  if (items.length === 0) {
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
  const childMessage =
    item.kind === 'background' ? childMessageForParentToolRunId(messages, item.id) : null
  const prompt = useMemo(() => {
    if (item.kind !== 'background') return null
    for (const message of messages) {
      for (const call of partsToolCalls(message.parts)) {
        if (call.toolUseId !== item.id) continue
        const input = call.input
        if (typeof input !== 'object' || input === null) return null
        const value = (input as Record<string, unknown>).prompt
        return typeof value === 'string' && value.trim() !== '' ? value : null
      }
    }
    return null
  }, [messages, item])

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

      {canStopTask(item) && (
        <Button
          variant="uncontained"
          size="small"
          leadingIcon="stop"
          className="self-start"
          onClick={() => chatActions.stopTask(item.key)}
        >
          {tr('common.stop')}
        </Button>
      )}
    </div>
  )
}

export function TaskTileContent(): React.JSX.Element {
  const items = useTaskBoard()
  const selected = useSelectedTask()
  const stopErrors = useChatSession((s) => s.taskStopErrors)
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
        <TaskProgressList items={items} stopErrors={stopErrors} />
      </TileSection>
      <TileSection titleKey="chat.taskTile.sections.output">
        <OutputSectionEmpty />
      </TileSection>
      <TileSection titleKey="chat.taskTile.sections.context">
        <ContextSectionEmpty />
      </TileSection>
    </div>
  )
}
