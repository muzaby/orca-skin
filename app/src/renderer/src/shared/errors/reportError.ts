import {
  APP_ERROR_DETAIL_MAX,
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
    const detail =
      raw == null
        ? undefined
        : raw.length > APP_ERROR_DETAIL_MAX
          ? raw.slice(0, APP_ERROR_DETAIL_MAX - 1) + '…'
          : raw
    presentErrorReport({
      id: crypto.randomUUID(),
      title: input.title,
      detail,
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
