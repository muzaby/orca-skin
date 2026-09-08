import { Icon } from '../../../../shared/ui/Icon'
import { Button } from '../../../../shared/ui/Button'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { chatActions } from '../../store/chatStore'
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
const CIRCLE =
  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong text-ink3'

export function WorkTaskProgress({
  items,
  selected
}: {
  items: TaskBoardItem[]
  selected?: TaskBoardItem
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div>
      {items.length === 0 ? (
        <div data-empty-progress aria-hidden="true" className="flex items-center px-5 py-5">
          {[0, 1, 2].map((step) => (
            <div key={step} className="flex items-center">
              {step > 0 && <span className="h-px w-3 bg-border-strong" />}
              <span className={`${CIRCLE} ${step === 2 ? 'bg-bg2' : 'bg-panel shadow-sm'}`}>
                {step < 2 && <Icon name="check" size={21} />}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex flex-wrap gap-y-3 px-5 py-5"
          role="group"
          aria-label={tr('chat.taskTile.sections.progress')}
        >
          {items.map((item, index) => (
            <div key={item.key} className="flex items-center">
              {index > 0 && <span aria-hidden className="h-px w-3 bg-border-strong" />}
              <button
                type="button"
                aria-label={`${item.subject}: ${tr(STATUS[item.status])}`}
                title={`${item.title} · ${tr(STATUS[item.status])}`}
                aria-pressed={selected?.key === item.key}
                onClick={() => chatActions.selectTask(selected?.key === item.key ? null : item.key)}
                className={`${CIRCLE} outline-none ring-focus hover:border-ink3 ${item.status === 'pending' ? 'bg-bg2' : 'shadow-sm'} ${selected?.key === item.key ? 'ring-2 ring-border-strong' : ''}`}
              >
                {item.status === 'completed' ? (
                  <Icon name="check" size={21} />
                ) : item.status === 'in_progress' || item.status === 'stopping' ? (
                  <span className="h-5 w-5 animate-spin rounded-full border border-border-strong border-t-ink motion-reduce:animate-none" />
                ) : item.status === 'paused' ? (
                  <Icon name="pause" size={16} />
                ) : item.status === 'failed' ? (
                  <Icon name="alert" size={16} className="text-bad" />
                ) : item.status === 'aborted' ? (
                  <Icon name="stop" size={16} />
                ) : null}
              </button>
            </div>
          ))}
        </div>
      )}
      {selected ? (
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
      ) : (
        <p className="px-4 pt-4 text-footnote leading-relaxed text-ink3">
          {tr('chat.taskTile.sections.progressDesc')}
        </p>
      )}
    </div>
  )
}
