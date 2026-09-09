import { useEffect, useLayoutEffect, useRef } from 'react'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { chatActions, useChatSession, useUnseenSettledTaskCount } from '../../store/chatStore'
import { taskBoardItemByKey } from '../../lib/taskBoard'
import { TileSection } from './TaskTileSections'
import { TaskOutputContent } from './TaskOutputContent'
import { TaskContextContent } from './TaskContextContent'
import { TaskDetail } from './TaskProgressList'
import { useTaskBoard } from '../../hooks/useTaskBoard'
import { WorkTaskProgress } from './WorkTaskProgress'

// 기존 호출부 import 호환. 구현은 계획과 Work가 공유하는 단일 모듈이다.
export { TaskProgressList } from './TaskProgressList'

export function TaskTileHeader(): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <span className="min-w-0 truncate text-footnote font-medium text-ink">
      {tr('chat.taskTile.headerTitle')}
    </span>
  )
}

export function TaskTileContent(): React.JSX.Element {
  const { tr } = useI18n()
  const items = useTaskBoard()
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  const loading = useChatSession((s) => s.loadingSession)
  const selected = taskBoardItemByKey(items, selectedKey)
  const visibleSelection = selected?.key ?? null
  const unseen = useUnseenSettledTaskCount()
  const overviewRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const overviewScroll = useRef(0)
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
    overview.scrollTop = overviewScroll.current
    const origin = Array.from(
      overview.querySelectorAll<HTMLButtonElement>('[data-task-detail-trigger]')
    ).find((button) => button.dataset.taskDetailTrigger === previous)
    ;(origin ?? overview).focus({ preventScroll: true })
  }, [visibleSelection])
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 숨기되 unmount하지 않아 접힘·출력 구독·더보기·폴더 선택 수명을 보존한다. */}
      <div
        ref={overviewRef}
        data-work-task-overview
        hidden={!!selected}
        inert={!!selected}
        tabIndex={-1}
        aria-label={tr('chat.taskTile.headerTitle')}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => {
          if (!selected) overviewScroll.current = event.currentTarget.scrollTop
        }}
        onClickCapture={(event) => {
          overviewScroll.current = event.currentTarget.scrollTop
        }}
      >
        <TileSection titleKey="chat.taskTile.sections.progress">
          <WorkTaskProgress items={items} />
        </TileSection>
        <TaskOutputContent />
        <TaskContextContent />
      </div>
      {selected && (
        <div
          data-work-task-detail={selected.key}
          role="region"
          aria-label={selected.subject}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-t5 px-4 py-3 pr-12">
            <Button
              ref={backRef}
              iconOnly
              size="small"
              leadingIcon="arrowL"
              data-behavior="action:back-to-work-overview"
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
