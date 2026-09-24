import type { BackgroundTaskRecord } from '../../../../../shared/background-task'
import { isBackgroundTerminal } from '../../../../../shared/background-task'
export function backgroundTaskStatus(
  task: BackgroundTaskRecord
): 'completed' | 'failed' | 'stopped' | 'running' | 'pending' | 'unknown' | 'excluded' {
  if (task.status === 'killed' || task.status === 'stopped') return 'stopped'
  if (task.status === 'completed' || task.status === 'failed') return task.status
  if (task.liveMembership === 'excluded') return 'excluded'
  if (task.status === 'running' || task.status === 'pending') return task.status
  return 'unknown'
}
export function canStopBackgroundTask(
  task: BackgroundTaskRecord,
  generation: string | undefined,
  connection: string
): boolean {
  return (
    task.generation === generation &&
    connection === 'connected' &&
    !isBackgroundTerminal(task.status) &&
    task.liveMembership !== 'excluded' &&
    task.stop?.state !== 'requested' &&
    task.stop?.state !== 'acknowledged'
  )
}
