import { CHANNELS } from '../../../shared/ipc'
import { handlePlain } from '../../infra/ipc/handle'
import { errorReportHub } from '../../infra/error-report'
import { shellServices } from '../../infra/shell-services'
import { flushLogSync, logDirectory } from '../../infra/log'
import { createErrorReportDrain } from '../error-report-drain'

export function registerErrorHandlers(): void {
  const drain = createErrorReportDrain(errorReportHub)
  handlePlain(CHANNELS.errorDrain, (_payload, event) => drain(event.sender))
  handlePlain(CHANNELS.errorRevealLog, async () => {
    // 로그는 프로세스마다 파일이 다르다(0324 AC46) — 한 파일을 고르지 않고 폴더를 연다.
    flushLogSync()
    const error = await shellServices().call('external.openPath', logDirectory())
    if (error) throw new Error(error)
  })
}
