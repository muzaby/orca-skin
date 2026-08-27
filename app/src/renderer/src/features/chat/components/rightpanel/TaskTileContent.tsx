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
  taskBoardGroups,
  taskBoardItemByKey,
  taskDetailRows,
  type TaskBoardGroup,
  type TaskBoardItem,
  type TaskBoardStatus,
  type TaskDetailValue
} from '../../lib/taskBoard'
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

const GROUP_KEY: Record<TaskBoardGroup, MessageKey> = {
  in_progress: 'chat.taskTile.group.in_progress',
  pending: 'chat.taskTile.group.pending',
  completed: 'chat.taskTile.group.completed',
  aborted: 'chat.taskTile.group.aborted',
  failed: 'chat.taskTile.group.failed'
}

// 메타 라인의 항목 구분 — 가시 간격 유지를 위해 nbsp 2칸(기존 백그라운드 목록과 동일 양식).
const GAP = '  '

// 현재 세션의 작업 목록. 중단 대기 집합이 바뀌면 재계산해야 '중단 중' 표시가 갱신된다 —
// 의존성에서 빠뜨리면 클릭이 화면에 반영되지 않는다(0204 §14).
function useTaskBoard(): TaskBoardItem[] {
  const messages = useChatSession((s) => s.messages)
  const stopping = useStoppingTasks()
  return useMemo(
    () => taskBoardFromMessages(messages, { stoppingBackgroundIds: stopping }),
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
  return pieces.join(GAP)
}

interface TaskRowProps {
  item: TaskBoardItem
  index: number
}

function TaskRow({ item, index }: TaskRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const stopError = useChatSession((s) => s.taskStopErrors[item.key])
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
      <div className="flex min-w-0 items-start gap-g3">
        <TaskStatusIcon status={item.status} index={index} />
        <span
          className={`min-w-0 flex-1 truncate text-body leading-[1.5] ${
            item.status === 'completed' ? 'text-t6' : 'font-medium text-t9'
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
        <div className="mt-0.5 truncate pl-7 text-footnote text-ink3">
          {backgroundMetaLine(tr, item)}
        </div>
      )}
      {stopError && <div className="mt-0.5 pl-7 text-footnote text-bad">{stopError}</div>}
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
  const { tr } = useI18n()
  const items = useTaskBoard()
  const selected = useSelectedTask()
  // 타일이 화면에 있으면 사용자가 결과를 본 것이다 — 미확인 배지를 계속 비운다(0204 D-004).
  const unseen = useUnseenSettledTaskCount()
  useEffect(() => {
    if (unseen > 0) chatActions.acknowledgeSettledTasks()
  }, [unseen])

  if (selected) return <TaskDetail item={selected} />

  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center">
          <p className="text-footnote font-medium text-t6">{tr('chat.taskTile.emptyTitle')}</p>
          <p className="text-caption text-ink3">{tr('chat.taskTile.emptyDesc')}</p>
        </div>
      </div>
    )
  }

  const groups = taskBoardGroups(items)
  return (
    <div className="min-h-0 flex-1 overflow-auto px-p3 py-p4">
      {groups.map((group, gi) => (
        <div key={group.status} className={gi > 0 ? 'mt-4' : ''}>
          <div className="mb-g2 mt-g1 flex items-center px-p2 text-footnote text-t6">
            <span>{tr(GROUP_KEY[group.status])}</span>
          </div>
          <div className="flex flex-col gap-px">
            {group.items.map((item, index) => (
              <TaskRow key={item.key} item={item} index={index + 1} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
