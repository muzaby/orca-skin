import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { Button } from '../../../../shared/ui/Button'
import { Popover } from '../../../../shared/ui/Popover'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { chatActions } from '../../store/chatStore'
import {
  taskDetailRows,
  type TaskBoardItem,
  type TaskBoardStatus,
  type TaskDetailValue
} from '../../lib/taskBoard'
import { TaskStatusIcon } from './TaskStatusIcon'

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

// 양 모드가 이 실제 목록을 사용한다. Work만 질문 callback을 제공한다.
export function TaskProgressList({
  items,
  agentTools = null,
  cliVersion = null,
  onAsk
}: {
  items: TaskBoardItem[]
  agentTools?: string[] | null
  cliVersion?: string | null
  onAsk?: (item: TaskBoardItem) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [tooltipAnchor, setTooltipAnchor] = useState<{
    element: HTMLButtonElement
    taskKey: string
  } | null>(null)
  const tooltipVisible =
    tooltipAnchor !== null && items.some((item) => item.key === tooltipAnchor.taskKey)
  const tooltipAnchorRef = useMemo(
    () => ({ current: tooltipAnchor?.element ?? null }),
    [tooltipAnchor]
  )
  const closeTooltip = useCallback(() => setTooltipAnchor(null), [])
  useEffect(() => {
    if (!tooltipAnchor || !tooltipVisible) return
    const closeOnFocus = (event: FocusEvent): void => {
      if (event.target !== tooltipAnchor.element) closeTooltip()
    }
    // 상세 진입의 Back focus와 섹션 스크롤은 숨은 overview의 portal도 닫는다.
    document.addEventListener('focusin', closeOnFocus)
    window.addEventListener('scroll', closeTooltip, true)
    return () => {
      document.removeEventListener('focusin', closeOnFocus)
      window.removeEventListener('scroll', closeTooltip, true)
    }
  }, [tooltipAnchor, tooltipVisible, closeTooltip])
  const unsupported =
    items.length === 0 && agentTools !== null && !agentTools.includes('TaskCreate')
  if (items.length === 0)
    return (
      <div className="flex flex-col gap-px">
        {unsupported ? (
          <div className="px-p2 text-caption text-ink3">
            <p>{tr('chat.taskTile.unsupported')}</p>
            {cliVersion && <p>{tr('chat.taskTile.unsupportedVersion', { version: cliVersion })}</p>}
          </div>
        ) : (
          <p className="px-p2 text-caption text-ink3">{tr('chat.taskTile.emptyDesc')}</p>
        )}
      </div>
    )
  return (
    <>
      <ol
        className="flex flex-col gap-2 px-4 py-2"
        aria-label={tr('chat.taskTile.sections.progress')}
      >
        {items.map((item, index) => {
          const blocked =
            item.status !== 'completed' && item.blockedBy.length > 0
              ? blockedByText(tr, item.blockedBy)
              : null
          return (
            <li
              key={item.key}
              data-task-row={item.key}
              data-status={item.status}
              className="group/task-row flex min-w-0 items-start gap-1"
            >
              <button
                type="button"
                data-task-detail-trigger={item.key}
                aria-label={`${item.subject}: ${tr(STATUS_KEY[item.status])}`}
                title={`${item.title} · ${tr(STATUS_KEY[item.status])}`}
                onClick={() => {
                  closeTooltip()
                  chatActions.selectTask(item.key)
                }}
                className="flex min-w-0 flex-1 items-start gap-3 rounded-r3 text-left outline-none ring-focus hover:bg-bg2"
              >
                <TaskStatusIcon status={item.status} position={index + 1} />
                <span className="min-w-0 flex-1 py-1">
                  <span
                    data-task-title
                    title={item.title}
                    className={`block min-w-0 truncate text-body leading-snug ${item.status === 'completed' ? 'text-ink3 line-through' : item.status === 'in_progress' ? 'text-ink' : 'text-ink2'}`}
                  >
                    {item.title}
                  </span>
                  {blocked && (
                    <span className="block truncate text-footnote text-ink3" title={blocked}>
                      {blocked}
                    </span>
                  )}
                </span>
              </button>
              {onAsk && (
                <span className="mt-0.5 shrink-0">
                  <Button
                    type="button"
                    size="compact"
                    iconOnly
                    leadingIcon="commentAdd"
                    aria-label={tr('chat.taskTile.askAboutTask')}
                    data-behavior="action:ask-about-task"
                    onMouseEnter={(event) =>
                      setTooltipAnchor({ element: event.currentTarget, taskKey: item.key })
                    }
                    onMouseLeave={closeTooltip}
                    onFocus={(event) =>
                      setTooltipAnchor({ element: event.currentTarget, taskKey: item.key })
                    }
                    onBlur={closeTooltip}
                    onClick={() => {
                      closeTooltip()
                      onAsk(item)
                    }}
                    className="opacity-0 group-hover/task-row:opacity-100 group-focus-within/task-row:opacity-100 focus:opacity-100"
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <Popover
        open={tooltipVisible}
        anchorRef={tooltipAnchorRef}
        onClose={closeTooltip}
        role="tooltip"
        align="end"
      >
        {tr('chat.taskTile.askAboutTask')}
      </Popover>
    </>
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
