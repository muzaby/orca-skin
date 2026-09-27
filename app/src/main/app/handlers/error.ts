import { CHANNELS } from '../../../shared/ipc'
import { handlePlain } from '../../infra/ipc/handle'
import { errorReportHub } from '../../infra/error-report'
import { createErrorReportDrain } from '../error-report-drain'

export function registerErrorHandlers(): void {
  const drain = createErrorReportDrain(errorReportHub)
  handlePlain(CHANNELS.errorDrain, (_payload, event) => drain(event.sender))
}
