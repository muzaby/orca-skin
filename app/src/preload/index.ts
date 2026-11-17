// preload — 얇은 다리 (0324 D-058 · EP-26 · AC52).
//
// sandbox 창의 preload 는 `require` 가 `electron` 하나만 불러온다 — 서드파티 의존(zod 등)을 두면 로드 중에
// 죽어 창이 빈다. 그래서 여기에는 셸 채널 요청·송신·구독 · 호스트 연결 요청과 종료 통지 · 포트 전달 ·
// 파일 경로 · `platform` 만 두고 `window.ooBridge` 로 노출한다. 호스트 포트·채널 소유에 따른 전송 선택·포트
// 클라이언트·세션 조각 조립·메시지 검증은 renderer 전송층(`renderer/src/shared/api/transport/`)이 갖고,
// renderer 가 이 다리 위에 `window.oo` 를 만든다. import 는 `electron` 과 zod 없는 shared 상수뿐이다 —
// 빌드 산출은 `scripts/smoke-preload.mjs` 가 본다.

import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { channelOwner } from '../shared/channel-owner'
import {
  HOST_CONNECT_CHANNEL,
  HOST_EXITED_CHANNEL,
  HOST_PORT_CHANNEL,
  HOST_PORT_MESSAGE,
  type HostConnectTarget,
  type HostName
} from '../shared/host-channels'

const isHost = (value: unknown): value is HostName => value === 'agent' || value === 'data'

// 다리는 셸 채널만 연다(EP-26 ②). 호스트 채널과 표에 없는 이름은 던진다 — 호스트 채널은 renderer 전송층이
// 그 호스트의 포트로 보낸다.
function shellChannel(channel: string): string {
  if (channelOwner(channel) !== 'shell') throw new Error(`셸 채널이 아니다: ${channel}`)
  return channel
}

// 셸이 넘긴 호스트 포트를 같은 창의 페이지 메인 월드로 넘긴다(EP-26 ③). 포트가 하나이고 호스트가
// 에이전트·데이터일 때만 넘긴다.
ipcRenderer.on(HOST_PORT_CHANNEL, (event: IpcRendererEvent, payload: { host?: unknown }) => {
  const host = payload?.host
  if (event.ports.length !== 1 || !isHost(host)) return
  window.postMessage({ type: HOST_PORT_MESSAGE, host }, '*', [event.ports[0]!])
})

const exitedHandlers = new Set<(host: HostName) => void>()
// 셸의 호스트 종료 통지(EP-26 ⑤) — 에이전트·데이터만 전달한다.
ipcRenderer.on(HOST_EXITED_CHANNEL, (_event: IpcRendererEvent, payload: { host?: unknown }) => {
  const host = payload?.host
  if (!isHost(host)) return
  for (const handler of [...exitedHandlers]) handler(host)
})

const bridge = {
  invoke: (channel: string, payload?: unknown): Promise<unknown> =>
    ipcRenderer.invoke(shellChannel(channel), payload),
  send: (channel: string, payload?: unknown): void =>
    ipcRenderer.send(shellChannel(channel), payload),
  // Electron 이벤트 객체는 경계를 넘기지 않는다. 반환값은 구독 해제다.
  on: (channel: string, handler: (payload: unknown) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: unknown): void => handler(payload)
    ipcRenderer.on(shellChannel(channel), listener)
    return () => {
      ipcRenderer.off(channel, listener)
    }
  },
  // 그 호스트의 포트를 달라(EP-26 ④) — 문서가 새로 읽힐 때 `'all'`, 호스트가 죽은 뒤 첫 요청에서 그 호스트.
  connectHost: (host: HostConnectTarget): void => {
    if (!isHost(host) && host !== 'all') throw new Error(`연결할 수 없는 호스트: ${String(host)}`)
    ipcRenderer.send(HOST_CONNECT_CHANNEL, { host })
  },
  onHostExited: (handler: (host: HostName) => void): (() => void) => {
    exitedHandlers.add(handler)
    return () => {
      exitedHandlers.delete(handler)
    }
  },
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  // 데스크톱 플랫폼 식별자 — renderer 의 `<html data-platform>` · WinControls 분기.
  platform: process.platform as 'darwin' | 'win32' | 'linux'
}

export type OoBridge = typeof bridge

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('ooBridge', bridge)
  } catch (error) {
    console.error(error)
  }
} else {
  // `index.d.ts` 가 같은 선언을 renderer 쪽에 준다 — 이 파일의 컴파일에는 그 d.ts 가 들지 않는다.
  ;(window as Window & { ooBridge?: OoBridge }).ooBridge = bridge
}
