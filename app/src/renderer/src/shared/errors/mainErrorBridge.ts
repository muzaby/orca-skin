import type { AppErrorReport } from '../../../../shared/app-error'
import { presentErrorReport, reportError } from './reportError'

interface MainErrorApi {
  onReport(handler: (report: AppErrorReport) => void): () => void
  drain(): Promise<AppErrorReport[]>
}

export async function connectMainErrorReports(
  api: MainErrorApi | undefined = typeof window === 'undefined' ? undefined : window.orca?.error
): Promise<() => void> {
  if (!api) return () => {}
  const seen = new Set<string>()
  const present = (report: AppErrorReport): void => {
    if (seen.has(report.id)) return
    seen.add(report.id)
    presentErrorReport(report)
  }
  const unsubscribe = api.onReport(present)
  try {
    for (const report of await api.drain()) present(report)
  } catch (error) {
    reportError({ event: 'errors.bridge.failed', scope: 'errors', title: 'unexpected', error })
  }
  return unsubscribe
}
