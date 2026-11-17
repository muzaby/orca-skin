// 오류 보고를 창에 보낸다 (0324 D-042 — 데이터 호스트가 모아 창에 준다). 받을 준비가 된 창
// (`errorDrain` 을 부른 창)에만 간다. 창 참조는 이 프로세스의 IPC 전송이 갖는다 — 데이터 호스트에서는
// 창마다 받은 포트다. 이 파일은 Electron 을 모른다.

import { CHANNELS } from '../../shared/ipc'
import { errorReportHub, setErrorReportSink } from '../infra/error-report'
import { ipcTransport } from '../infra/ipc/transport'

export function installErrorReportSink(): void {
  setErrorReportSink((id, report) => {
    const client = ipcTransport()
      .clients()
      .find((candidate) => candidate.id === id)
    if (!client || client.isClosed()) {
      errorReportHub.forget(id)
      return
    }
    client.send(CHANNELS.errorReportEvent, report)
  })
}
