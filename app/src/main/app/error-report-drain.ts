import type { AppErrorReport } from '../../shared/app-error'
import type { ErrorReportHub } from '../infra/error-report/hub'

interface ErrorReportSender {
  id: number
  onClosed(listener: () => void): unknown
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
      // 닫힌 참조는 다시 요청하지 않는다 — 새 문서는 새 참조로 온다.
      sender.onClosed(() => hub.forget(id))
    }
    return hub.markReady(id)
  }
}
