import type { AppErrorReport } from '../../shared/app-error'
import type { ErrorReportHub } from '../infra/error-report/hub'

interface ErrorReportSender {
  id: number
  once(event: 'destroyed', callback: () => void): unknown
}

/** The IPC handler's lifetime logic, with a structural sender for non-Electron tests. */
export function createErrorReportDrain(
  hub: ErrorReportHub
): (sender: ErrorReportSender) => AppErrorReport[] {
  const watched = new WeakSet<ErrorReportSender>()
  return (sender) => {
    const id = sender.id
    if (!watched.has(sender)) {
      watched.add(sender)
      sender.once('destroyed', () => hub.forget(id))
    }
    return hub.markReady(id)
  }
}
