import {
  clampErrorDetail,
  type AppErrorReport,
  type AppErrorTarget,
  type AppErrorTitle
} from '../../../../shared/app-error'
import { rendererLog } from '../logging'
import { errorToastStore } from './errorToastStore'

export function reportError(input: {
  event: string
  scope: string
  title: AppErrorTitle
  error?: unknown
  detail?: string | null
  data?: Record<string, unknown>
  target?: AppErrorTarget
}): void {
  try {
    rendererLog.error(input.event, input.scope, input.error, input.data)
    const raw =
      input.detail === undefined && input.error !== undefined
        ? input.error instanceof Error
          ? input.error.message
          : String(input.error)
        : input.detail
    presentErrorReport({
      id: crypto.randomUUID(),
      title: input.title,
      detail: clampErrorDetail(raw),
      origin: 'renderer',
      target: input.target
    })
  } catch {
    // No rethrow or recursive reporting. The original failure is logged before presentation.
  }
}

/** Main reports are already logged by main. Receiving them must not create a second log entry. */
export function presentErrorReport(report: AppErrorReport): void {
  try {
    errorToastStore.getState().push(report)
  } catch {
    // A broken UI must not feed its own global error handler.
  }
}
