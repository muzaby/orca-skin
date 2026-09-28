import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { shell } from 'electron'
import { CHANNELS } from '../../../shared/ipc'
import { handlePlain } from '../../infra/ipc/handle'
import { errorReportHub } from '../../infra/error-report'
import { currentLogFilePath, flushLogSync } from '../../infra/log'
import { createErrorReportDrain } from '../error-report-drain'

export function registerErrorHandlers(): void {
  const drain = createErrorReportDrain(errorReportHub)
  handlePlain(CHANNELS.errorDrain, (_payload, event) => drain(event.sender))
  handlePlain(CHANNELS.errorRevealLog, async () => {
    flushLogSync()
    const path = currentLogFilePath()
    if (existsSync(path)) {
      shell.showItemInFolder(path)
    } else {
      const error = await shell.openPath(dirname(path))
      if (error) throw new Error(error)
    }
  })
}
