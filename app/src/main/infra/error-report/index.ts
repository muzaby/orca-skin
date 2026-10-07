import { randomUUID } from 'node:crypto'
import {
  clampErrorDetail,
  type AppErrorTitle,
  type AppErrorTarget
} from '../../../shared/app-error'
import { errorMessage } from '../errors'
import { getLogger } from '../log/registry'
import { ErrorReportHub, type ErrorReportSink } from './hub'

export interface MainErrorReportInput {
  event: string
  scope: string
  title: AppErrorTitle
  error?: unknown
  detail?: string | null
  data?: Record<string, unknown>
  level?: 'error' | 'warn'
  target?: AppErrorTarget
}

export const errorReportHub = new ErrorReportHub()

export function setErrorReportSink(sink: ErrorReportSink): void {
  errorReportHub.setSink(sink)
}

export function reportError(input: MainErrorReportInput): void {
  try {
    const log = getLogger().child(input.scope)
    if (input.level === 'warn') {
      log.warn(input.event, {
        ...(input.error === undefined ? {} : { message: errorMessage(input.error) }),
        ...input.data
      })
    } else {
      log.error(input.event, input.error, input.data)
    }
    publishErrorReport({
      title: input.title,
      target: input.target,
      detail:
        input.detail === undefined && input.error !== undefined
          ? errorMessage(input.error)
          : input.detail
    })
  } catch {
    // Reporting must never re-enter the global exception handler. Logging precedes delivery.
  }
}

/** Only scheduler transitions and aggregated config warnings may publish after logging themselves. */
export function publishErrorReport(input: {
  title: AppErrorTitle
  detail?: string | null
  target?: AppErrorTarget
}): void {
  try {
    errorReportHub.publish({
      id: randomUUID(),
      title: input.title,
      detail: clampErrorDetail(input.detail),
      origin: 'main',
      target: input.target
    })
  } catch {
    // The caller has already logged this failure. Do not recursively report delivery errors.
  }
}
