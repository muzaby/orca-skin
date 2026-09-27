import { webContents } from 'electron'
import { CHANNELS } from '../../shared/ipc'
import { errorReportHub, setErrorReportSink } from '../infra/error-report'

export function installErrorReportSink(): void {
  setErrorReportSink((id, report) => {
    const contents = webContents.fromId(id)
    if (!contents || contents.isDestroyed()) {
      errorReportHub.forget(id)
      return
    }
    try {
      contents.send(CHANNELS.errorReportEvent, report)
    } catch {
      // Destruction can race send; continue delivering to other ready windows.
      errorReportHub.forget(id)
    }
  })
}
