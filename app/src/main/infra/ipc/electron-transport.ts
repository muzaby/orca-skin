// 셸의 전송 — `ipcMain` 과 `webContents` (0324 EP-8·EP-9). `ipcMain` 을 직접 부르는 유일한 파일이다
// (가드 (d)). 등록 API 는 `handle.ts` 의 세 함수이고 이 파일은 그 밑의 배선만 갖는다.

import {
  BrowserWindow,
  ipcMain,
  webContents,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import type { WebContents } from 'electron'
import { CloseSignal, type ClientRef, type IpcTransport, type RequestEvent } from './transport'

interface WindowClient extends ClientRef {
  readonly contents: WebContents
}

const refs = new WeakMap<WebContents, WindowClient>()

// 창 하나의 현재 문서에 대응하는 참조. 문서가 새로 읽히면 닫힌 것으로 치고 다음 요청에 새로 만든다.
// 닫힘 감시는 처음 구독할 때 건다 — 방송만 받는 창에는 리스너를 달지 않는다.
export function clientOf(contents: WebContents): ClientRef {
  const existing = refs.get(contents)
  if (existing) return existing
  const signal = new CloseSignal()
  let watching = false
  const close = (): void => {
    if (refs.get(contents) === ref) refs.delete(contents)
    contents.removeListener('destroyed', close)
    contents.removeListener('render-process-gone', close)
    contents.removeListener('did-start-navigation', navigate)
    signal.close()
  }
  const navigate = (_event: unknown, _url: string, inPlace: boolean, main: boolean): void => {
    if (main && !inPlace) close()
  }
  const ref: WindowClient = {
    contents,
    id: contents.id,
    send: (channel, payload) => {
      if (!signal.isClosed() && !contents.isDestroyed()) contents.send(channel, payload)
    },
    isClosed: () => signal.isClosed() || contents.isDestroyed(),
    onClosed: (listener) => {
      if (!watching && !signal.isClosed()) {
        watching = true
        contents.once('destroyed', close)
        contents.on('render-process-gone', close)
        contents.on('did-start-navigation', navigate)
      }
      return signal.onClosed(listener)
    }
  }
  refs.set(contents, ref)
  return ref
}

// 셸 서비스가 창 자체(포커스 판정 등)를 봐야 할 때만 쓴다.
export function contentsOf(client: ClientRef): WebContents | null {
  const contents = (client as Partial<WindowClient>).contents
  return contents && refs.get(contents) === client ? contents : null
}

export function createElectronTransport(options: {
  isTrusted: (event: IpcMainInvokeEvent | IpcMainEvent) => boolean
}): IpcTransport {
  // 창 참조와 신뢰 판정은 핸들러가 읽을 때 만든다 — 대부분의 핸들러는 둘 다 보지 않는다.
  const toEvent = (event: IpcMainInvokeEvent | IpcMainEvent): RequestEvent => ({
    get sender() {
      return clientOf(event.sender)
    },
    get trusted() {
      return options.isTrusted(event)
    }
  })
  return {
    handle: (channel, listener) => {
      ipcMain.handle(channel, (event, raw: unknown) => listener(toEvent(event), raw))
    },
    on: (channel, listener) => {
      ipcMain.on(channel, (event, raw: unknown) => listener(toEvent(event), raw))
    },
    clients: () =>
      webContents
        .getAllWebContents()
        .filter((contents) => !contents.isDestroyed())
        .map(clientOf),
    primaryClient: () => {
      const win = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed())
      return win && !win.webContents.isDestroyed() ? clientOf(win.webContents) : undefined
    }
  }
}
