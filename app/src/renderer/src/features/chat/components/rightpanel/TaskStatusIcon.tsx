import { Icon } from '../../../../shared/ui/Icon'
import type { TaskBoardStatus } from '../../lib/taskBoard'

const STATUS_CIRCLE: Record<TaskBoardStatus, string> = {
  in_progress: 'border border-indigo bg-selected-soft text-selected',
  completed: 'bg-indigo text-paper',
  pending: 'bg-bg2 text-ink3',
  stopping: 'border border-indigo bg-selected-soft text-selected',
  paused: 'bg-bg2 text-ink2',
  aborted: 'bg-bg2 text-ink3',
  failed: 'bg-bg2 text-bad'
}

// 순번과 실제 상태를 두 패널에서 같은 크기·색·동작으로 표시한다.
export function TaskStatusIcon({
  status,
  position
}: {
  status: TaskBoardStatus
  position: number
}): React.JSX.Element {
  return (
    <span
      data-task-status={status}
      aria-hidden="true"
      className={`relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-caption font-medium ${STATUS_CIRCLE[status]}`}
    >
      {status === 'in_progress' && (
        <span className="pointer-events-none absolute -inset-px animate-spin rounded-full border-2 border-transparent border-t-indigo motion-reduce:animate-none" />
      )}
      {status === 'completed' ? (
        <Icon name="check" size={18} />
      ) : status === 'stopping' ? (
        <span className="h-4 w-4 animate-spin rounded-full border border-indigo border-t-transparent motion-reduce:animate-none" />
      ) : status === 'paused' ? (
        <Icon name="pause" size={16} />
      ) : status === 'failed' ? (
        <Icon name="alert" size={16} />
      ) : status === 'aborted' ? (
        <Icon name="stop" size={16} />
      ) : (
        position
      )}
    </span>
  )
}
