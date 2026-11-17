// 셸의 호스트 배선 중 Electron 에 닿는 두 자리 (0324 EP-9 · EP-19 · §7-E).
//
// - `forkHost` — 호스트 하나를 utility 프로세스로 띄워 감독자가 아는 모양(`HostProcess`)으로 돌려준다.
// - `attachHostPorts` — 창 하나의 호스트 포트. preload 가 문서마다 포트를 달라고 하면(`'all'`) 두 호스트의
//   새 포트를 넘기고, 에이전트 호스트가 죽은 뒤 첫 요청(`'agent'`)이면 다시 띄운다.
//
// 순서·재기동 규칙은 `boot.ts`·`host-supervisor.ts` 가 갖는다(Electron 없이 시험한다). 이 파일은 그
// 규칙이 부르는 Electron 호출만 한다 — `utilityProcess` · 포트 `postMessage` · 셸 ↔ preload 전용 채널.

import { ipcMain, utilityProcess, type MessagePortMain, type WebContents } from 'electron'
import {
  HOST_CONNECT_CHANNEL,
  HOST_EXITED_CHANNEL,
  HOST_PORT_CHANNEL,
  HostConnectRequestSchema,
  type HostName
} from '../../../shared/host-protocol'
import { PRODUCT_DISPLAY_NAME } from '../../../shared/product'
import type { HostEnvironment } from '../../infra/host-environment'
import { isTrustedAppDocument } from '../artifact-sender'
import { hostEnvironmentArg } from '../host-runtime'
import type { BootClient, HostBoot, HostKind } from './boot'
import type { HostProcess, SupervisedClient } from './host-supervisor'

export function forkHost(
  kind: HostKind,
  modulePath: string,
  environment: HostEnvironment
): HostProcess<MessagePortMain> {
  const child = utilityProcess.fork(modulePath, [hostEnvironmentArg(environment)], {
    serviceName: `${PRODUCT_DISPLAY_NAME} ${kind === 'data' ? 'Data' : 'Agent'} Host`
  })
  return {
    pid: () => child.pid,
    postMessage: (message, ports) => child.postMessage(message, ports ? [...ports] : []),
    onMessage: (listener) => {
      child.on('message', listener)
    },
    onExit: (listener) => {
      child.on('exit', listener)
    },
    kill: () => {
      child.kill()
    }
  }
}

export function attachHostPorts(
  boot: Pick<HostBoot<MessagePortMain>, 'attach' | 'detach' | 'connectAgent'>,
  contents: WebContents,
  rendererUrl: string
): void {
  const id = contents.id
  const supervised = (host: HostName): SupervisedClient<MessagePortMain> => ({
    id,
    trusted: () => isTrustedAppDocument(contents, rendererUrl),
    deliverPort: (port) => {
      if (!contents.isDestroyed()) contents.postMessage(HOST_PORT_CHANNEL, { host }, [port])
    },
    notify: (event) => {
      if (event === 'exited' && !contents.isDestroyed())
        contents.send(HOST_EXITED_CHANNEL, { host })
    }
  })
  const client: BootClient<MessagePortMain> = {
    id,
    data: supervised('data'),
    agent: supervised('agent')
  }
  const onConnect = (event: Electron.IpcMainEvent, raw: unknown): void => {
    if (event.sender !== contents) return
    const parsed = HostConnectRequestSchema.safeParse(raw)
    if (!parsed.success) return
    if (parsed.data.host === 'agent') {
      boot.connectAgent()
      return
    }
    // 새 문서 — 옛 포트는 문서와 함께 닫혔다. 두 호스트의 포트를 새로 받는다.
    boot.detach(id)
    boot.attach(client)
  }
  ipcMain.on(HOST_CONNECT_CHANNEL, onConnect)
  contents.once('destroyed', () => {
    ipcMain.removeListener(HOST_CONNECT_CHANNEL, onConnect)
    boot.detach(id)
  })
}
