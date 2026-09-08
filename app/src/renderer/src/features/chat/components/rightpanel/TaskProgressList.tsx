import { useEffect } from 'react'
import type { TFunction } from 'i18next'
import { Button } from '../../../../shared/ui/Button'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { chatActions, useChatSession, useUnseenSettledTaskCount } from '../../store/chatStore'
import {
  taskBoardItemByKey,
  taskDetailRows,
  type TaskBoardItem,
  type TaskBoardStatus,
  type TaskDetailValue
} from '../../lib/taskBoard'
import { TaskStatusIcon } from './TaskStatusIcon'
import { useTaskBoard } from '../../hooks/useTaskBoard'

const STATUS_KEY: Record<TaskBoardStatus, MessageKey> = {
  in_progress: 'chat.taskTile.status.in_progress',
  stopping: 'chat.taskTile.status.stopping',
  paused: 'chat.taskTile.status.paused',
  pending: 'chat.taskTile.status.pending',
  completed: 'chat.taskTile.status.completed',
  aborted: 'chat.taskTile.status.aborted',
  failed: 'chat.taskTile.status.failed'
}

function blockedByText(tr: TFunction, ids: string[]): string {
  return tr('chat.taskTile.blockedByValue', { ids: ids.join(', #') })
}

function blockedRowText(tr: TFunction, item: TaskBoardItem): string | null {
  if (item.status === 'completed' || item.blockedBy.length === 0) return null
  return blockedByText(tr, item.blockedBy)
}

function detailValueText(tr: TFunction, value: TaskDetailValue): string {
  switch (value.kind) {
    case 'statusLabel':
      return tr(STATUS_KEY[value.status])
    case 'text':
      return value.text
    case 'taskIds':
      return blockedByText(tr, value.ids)
  }
}

type TaskListVariant = 'default' | 'plan'

function TaskRow({
  item,
  variant
}: {
  item: TaskBoardItem
  variant: TaskListVariant
}): React.JSX.Element {
  const { tr } = useI18n()
  const open = (): void => chatActions.selectTask(item.key)
  const blockedRow = blockedRowText(tr, item)
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
      // 접근성 이름은 안정 subject, 화면 제목은 진행 중 activeForm을 사용한다.
      aria-label={tr('chat.taskTile.openDetailAria', { description: item.subject })}
      aria-description={tr(STATUS_KEY[item.status])}
      className="group/task cursor-pointer rounded-r6 px-p2 py-1.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
    >
      <div className="flex min-w-0 items-start gap-g2">
        {item.status === 'pending' ? (
          <TaskStatusIcon status="pending" badge={item.id} variant={variant} />
        ) : (
          <TaskStatusIcon status={item.status} variant={variant} />
        )}
        <span
          className={`min-w-0 truncate text-body leading-[1.5] ${
            item.status === 'completed' ? 'text-t6 line-through' : 'font-medium text-t9'
          }`}
        >
          {item.title}
        </span>
      </div>
      {blockedRow && (
        <div className="mt-0.5 truncate pl-6 text-footnote text-ink3">{blockedRow}</div>
      )}
    </div>
  )
}

// 목록은 props-only View. 정렬·상태·의존 관계의 소유자는 taskBoard다.
export function TaskProgressList({
  items,
  agentTools = null,
  cliVersion = null,
  variant = 'default'
}: {
  items: TaskBoardItem[]
  // null은 지원 판정 불가이며, 실제 init의 도구 목록이 없으면 미지원 안내를 만들지 않는다.
  agentTools?: string[] | null
  cliVersion?: string | null
  variant?: TaskListVariant
}): React.JSX.Element {
  const { tr } = useI18n()
  const unsupported =
    items.length === 0 && agentTools !== null && !agentTools.includes('TaskCreate')
  return (
    <div className="flex flex-col gap-px">
      {unsupported && (
        <div className="px-p2 text-caption text-ink3">
          <p>{tr('chat.taskTile.unsupported')}</p>
          {cliVersion && <p>{tr('chat.taskTile.unsupportedVersion', { version: cliVersion })}</p>}
        </div>
      )}
      {items.length === 0 && !unsupported && (
        <p className="px-p2 text-caption text-ink3">{tr('chat.taskTile.emptyDesc')}</p>
      )}
      {items.map((item) => (
        <TaskRow key={item.key} item={item} variant={variant} />
      ))}
    </div>
  )
}

export function TaskDetail({ item }: { item: TaskBoardItem }): React.JSX.Element {
  const { tr } = useI18n()
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
    </div>
  )
}

// Coding 계획 하단의 목록/상세만 전환한다. 상단 계획과 댓글 선택 컨테이너는 유지된다.
export function TaskProgressContent(): React.JSX.Element {
  const { tr } = useI18n()
  const items = useTaskBoard()
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  const selected = taskBoardItemByKey(items, selectedKey)
  const agentTools = useChatSession((s) => s.agentTools)
  const cliVersion = useChatSession((s) => s.cliVersion)
  const unseen = useUnseenSettledTaskCount()
  useEffect(() => {
    if (unseen > 0) chatActions.acknowledgeSettledTasks()
  }, [unseen])

  if (selected) {
    return (
      <div>
        <div className="flex min-w-0 items-center gap-g1">
          <Button
            iconOnly
            size="small"
            leadingIcon="arrowL"
            onClick={() => chatActions.selectTask(null)}
            aria-label={tr('chat.taskTile.backToList')}
          />
          <span className="min-w-0 truncate text-body text-t9">{selected.subject}</span>
        </div>
        <TaskDetail item={selected} />
      </div>
    )
  }

  return (
    <TaskProgressList
      items={items}
      agentTools={agentTools}
      cliVersion={cliVersion}
      variant="plan"
    />
  )
}
