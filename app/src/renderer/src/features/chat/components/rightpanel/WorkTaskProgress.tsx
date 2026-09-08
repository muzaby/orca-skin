import { Icon } from '../../../../shared/ui/Icon'
import { Button } from '../../../../shared/ui/Button'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { chatActions, useChatStore } from '../../store/chatStore'
import type { TaskBoardItem, TaskBoardStatus } from '../../lib/taskBoard'
import { TaskDetail } from './TaskProgressList'

const STATUS: Record<TaskBoardStatus, MessageKey> = {
  pending: 'chat.taskTile.status.pending',
  in_progress: 'chat.taskTile.status.in_progress',
  completed: 'chat.taskTile.status.completed',
  stopping: 'chat.taskTile.status.stopping',
  paused: 'chat.taskTile.status.paused',
  aborted: 'chat.taskTile.status.aborted',
  failed: 'chat.taskTile.status.failed'
}
const EMPTY_CIRCLE =
  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong text-ink3'
const STATUS_CIRCLE: Record<TaskBoardStatus, string> = {
  in_progress: 'border border-indigo bg-selected-soft text-selected',
  completed: 'bg-indigo text-paper',
  pending: 'bg-bg2 text-ink3',
  stopping: 'border border-indigo bg-selected-soft text-selected',
  paused: 'bg-bg2 text-ink2',
  aborted: 'bg-bg2 text-ink3',
  failed: 'bg-bg2 text-bad'
}

export function WorkTaskProgress({
  items,
  selected
}: {
  items: TaskBoardItem[]
  selected?: TaskBoardItem
}): React.JSX.Element {
  const { tr } = useI18n()
  const activeKey = useChatStore((state) => state.activeKey)
  return (
    <div>
      {items.length === 0 ? (
        <>
          <div data-empty-progress aria-hidden="true" className="flex items-center px-5 py-5">
            {[0, 1, 2].map((step) => (
              <div key={step} className="flex items-center">
                {step > 0 && <span className="h-px w-3 bg-border-strong" />}
                <span className={`${EMPTY_CIRCLE} ${step === 2 ? 'bg-bg2' : 'bg-panel shadow-sm'}`}>
                  {step < 2 && <Icon name="check" size={21} />}
                </span>
              </div>
            ))}
          </div>
          <p className="px-4 pt-4 text-footnote leading-relaxed text-ink3">
            {tr('chat.taskTile.sections.progressDesc')}
          </p>
        </>
      ) : (
        <ol
          className="flex flex-col gap-2 px-4 py-2"
          aria-label={tr('chat.taskTile.sections.progress')}
        >
          {items.map((item, index) => (
            <li
              key={item.key}
              data-work-task={item.key}
              data-status={item.status}
              className="group/work-task flex min-w-0 items-start gap-1"
            >
              <button
                type="button"
                aria-label={`${item.subject}: ${tr(STATUS[item.status])}`}
                title={`${item.title} · ${tr(STATUS[item.status])}`}
                aria-pressed={selected?.key === item.key}
                onClick={() => chatActions.selectTask(selected?.key === item.key ? null : item.key)}
                className={`flex min-w-0 flex-1 items-start gap-3 rounded-r3 text-left outline-none ring-focus ${selected?.key === item.key ? 'bg-selected-soft' : 'hover:bg-bg2'}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-caption font-medium ${STATUS_CIRCLE[item.status]}`}
                >
                  {item.status === 'completed' ? (
                    <Icon name="check" size={18} />
                  ) : item.status === 'stopping' ? (
                    <span className="h-4 w-4 animate-spin rounded-full border border-indigo border-t-transparent motion-reduce:animate-none" />
                  ) : item.status === 'paused' ? (
                    <Icon name="pause" size={16} />
                  ) : item.status === 'failed' ? (
                    <Icon name="alert" size={16} />
                  ) : item.status === 'aborted' ? (
                    <Icon name="stop" size={16} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 break-words py-1 text-body leading-snug ${item.status === 'completed' ? 'text-ink3 line-through' : item.status === 'in_progress' ? 'text-ink' : 'text-ink2'}`}
                >
                  {item.title}
                </span>
              </button>
              <span className="group/task-question relative mt-0.5 shrink-0">
                <Button
                  type="button"
                  size="compact"
                  iconOnly
                  leadingIcon="commentAdd"
                  aria-label={tr('chat.taskTile.askAboutTask')}
                  data-behavior="action:ask-about-task"
                  onClick={() =>
                    chatActions.restoreComposerDraft(
                      activeKey,
                      `> ${item.subject.replace(/\r?\n/g, '\n> ')}\n\n`,
                      'append'
                    )
                  }
                  className="opacity-0 group-hover/work-task:opacity-100 group-focus-within/work-task:opacity-100 focus:opacity-100"
                />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 whitespace-nowrap rounded-r4 bg-ink px-2.5 py-1.5 text-caption text-bg opacity-0 shadow-sm group-hover/task-question:opacity-100 group-focus-within/task-question:opacity-100"
                >
                  {tr('chat.taskTile.askAboutTask')}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {selected && (
        <div>
          <Button
            size="small"
            leadingIcon="arrowL"
            className="mx-4"
            onClick={() => chatActions.selectTask(null)}
          >
            {tr('chat.taskTile.backToList')}
          </Button>
          <p className="px-4 pt-2 text-footnote text-ink">{selected.title}</p>
          <TaskDetail item={selected} />
        </div>
      )}
    </div>
  )
}
