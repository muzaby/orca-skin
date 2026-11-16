import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { CHANNELS } from '../../../shared/ipc'
import { handlePlain } from '../../infra/ipc/handle'
import { errorReportHub } from '../../infra/error-report'
import { shellServices } from '../../infra/shell-services'
import { currentLogFilePath, flushLogSync } from '../../infra/log'
import { createErrorReportDrain } from '../error-report-drain'

export function registerErrorHandlers(): void {
  const drain = createErrorReportDrain(errorReportHub)
  handlePlain(CHANNELS.errorDrain, (_payload, event) => drain(event.sender))
  handlePlain(CHANNELS.errorRevealLog, async () => {
    flushLogSync()
    const path = currentLogFilePath()
    if (existsSync(path)) {
      await shellServices().call('external.showItemInFolder', path)
    } else {
      const error = await shellServices().call('external.openPath', dirname(path))
      if (error) throw new Error(error)
    }
  })
}
