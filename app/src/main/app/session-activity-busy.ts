import type { ChatActivitySnapshot } from '../../shared/ipc'

// Work that dies with the session process: the response, queued or undelivered messages,
// background tasks, a pending wakeup and session schedules.
export function sessionActivityBusy(activity: ChatActivitySnapshot): boolean {
  return (
    activity.foreground !== 'idle' ||
    activity.transport === 'listening' ||
    activity.queuedCount > 0 ||
    activity.deliveryPendingCount > 0 ||
    activity.residualCount > 0 ||
    activity.backgroundTaskCount > 0 ||
    !!activity.pendingSessionWakeup ||
    (activity.sessionSchedules?.length ?? 0) > 0
  )
}
