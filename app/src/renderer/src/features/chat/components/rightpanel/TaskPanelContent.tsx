import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { chatActions, useChatSession, useUnseenSettledTaskCount } from '../../store/chatStore'
import { taskBoardItemByKey, type TaskBoardItem } from '../../lib/taskBoard'
import { TaskDetail } from './TaskProgressList'

// 두 작업 패널의 선택 수명만 공유한다. 문서/섹션/구독은 mounted overview의 소유다.
export function TaskPanelContent({
  items,
  mode,
  overviewClassName = '',
  children
}: {
  items: TaskBoardItem[]
  mode: 'work' | 'plan'
  overviewClassName?: string
  children: ReactNode
}): React.JSX.Element {
  const { tr } = useI18n()
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  const loading = useChatSession((s) => s.loadingSession)
  const selected = taskBoardItemByKey(items, selectedKey)
  const visibleSelection = selected?.key ?? null
  const unseen = useUnseenSettledTaskCount()
  const overviewRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const scrollPositions = useRef(new Map<string, number>())
  const previousSelection = useRef<string | null>(null)
  useEffect(() => {
    if (unseen > 0 && !visibleSelection) chatActions.acknowledgeSettledTasks()
  }, [unseen, visibleSelection])
  useEffect(() => {
    if (selectedKey && !selected && !loading) chatActions.selectTask(null)
  }, [selectedKey, selected, loading])
  useLayoutEffect(() => {
    const previous = previousSelection.current
    previousSelection.current = visibleSelection
    if (visibleSelection) {
      backRef.current?.focus({ preventScroll: true })
      return
    }
    const overview = overviewRef.current
    if (!previous || !overview) return
    overview.scrollTop = scrollPositions.current.get('overview') ?? 0
    for (const region of overview.querySelectorAll<HTMLElement>('[data-task-section-scroll]')) {
      const top = scrollPositions.current.get(region.dataset.taskSectionScroll!)
      if (top !== undefined) region.scrollTop = top
    }
    const origin = Array.from(
      overview.querySelectorAll<HTMLButtonElement>('[data-task-detail-trigger]')
    ).find((button) => button.dataset.taskDetailTrigger === previous)
    ;(origin ?? overview).focus({ preventScroll: true })
  }, [visibleSelection])
  return (
    <div className={`flex min-h-0 flex-col ${mode === 'plan' ? 'flex-1' : ''}`}>
      <div
        ref={overviewRef}
        data-work-task-overview={mode === 'work' ? '' : undefined}
        data-plan-task-overview={mode === 'plan' ? '' : undefined}
        hidden={!!selected}
        inert={!!selected}
        tabIndex={-1}
        aria-label={tr('chat.taskTile.headerTitle')}
        className={`min-h-0 ${selected ? 'hidden' : overviewClassName}`}
        onScrollCapture={(event) => {
          if (selected) return
          const target = event.target as HTMLElement
          const key = target === overviewRef.current ? 'overview' : target.dataset.taskSectionScroll
          if (key) scrollPositions.current.set(key, target.scrollTop)
        }}
        onClickCapture={() => {
          const overview = overviewRef.current
          if (!overview) return
          scrollPositions.current.set('overview', overview.scrollTop)
          for (const region of overview.querySelectorAll<HTMLElement>('[data-task-section-scroll]'))
            scrollPositions.current.set(region.dataset.taskSectionScroll!, region.scrollTop)
        }}
      >
        {children}
      </div>
      {selected && (
        <div
          data-work-task-detail={mode === 'work' ? selected.key : undefined}
          data-plan-task-detail={mode === 'plan' ? selected.key : undefined}
          role="region"
          aria-label={selected.subject}
          className={`flex min-h-0 flex-col overflow-hidden ${mode === 'work' ? 'h-[calc(100cqh-2px)]' : 'flex-1'}`}
        >
          <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-t5 px-4 py-3">
            <Button
              ref={backRef}
              iconOnly
              size="small"
              leadingIcon="arrowL"
              data-behavior={`action:back-to-${mode}-overview`}
              aria-label={tr('chat.taskTile.backToList')}
              title={tr('chat.taskTile.backToList')}
              onClick={() => chatActions.selectTask(null)}
            />
            <h2
              className="min-w-0 truncate text-body font-medium text-ink"
              title={selected.subject}
            >
              {selected.subject}
            </h2>
          </div>
          <TaskDetail key={selected.key} item={selected} />
        </div>
      )}
    </div>
  )
}
