// preload 다리 (0324 D-058 · EP-26 규칙 칸 · AC52 · AC24″).
//
// `electron` 을 흉내 내고 `contextBridge.exposeInMainWorld` 가 받은 실제 다리를 부른다 — 재구현이 아니라
// production 객체다. 다리는 셸 채널만 열고, 셸이 넘긴 호스트 포트를 같은 창의 `window.postMessage` 로 넘긴다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../shared/ipc'
import {
  HOST_CONNECT_CHANNEL,
  HOST_EXITED_CHANNEL,
  HOST_PORT_CHANNEL,
  HOST_PORT_MESSAGE
} from '../shared/host-channels'
import type { OoBridge } from './index'

const harness = vi.hoisted(() => ({
  exposed: [] as Array<[string, unknown]>,
  invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => 'answer'),
  send: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  listeners: new Map<string, (event: unknown, payload: unknown) => void>(),
  getPathForFile: vi.fn(() => 'C:/picked.txt'),
  postMessage: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) => harness.exposed.push([key, api])
  },
  ipcRenderer: {
    invoke: harness.invoke,
    send: harness.send,
    on: (channel: string, listener: (event: unknown, payload: unknown) => void) => {
      harness.on(channel, listener)
      harness.listeners.set(channel, listener)
    },
    off: harness.off
  },
  webUtils: { getPathForFile: harness.getPathForFile }
}))

// contextIsolated 가 거짓이면 모듈이 `window.ooBridge` 분기로 간다 — production 창은 격리돼 있다.
Object.defineProperty(process, 'contextIsolated', { value: true, configurable: true })
vi.stubGlobal('window', { postMessage: harness.postMessage })

await import('./index')
const bridge = harness.exposed[0]?.[1] as OoBridge

// 셸 → preload 통지 하나 — 모듈이 등록한 `ipcRenderer.on` 리스너를 부른다.
const fromShell = (channel: string, payload: unknown, ports: unknown[] = []): void =>
  harness.listeners.get(channel)!({ ports }, payload)

beforeEach(() => {
  harness.invoke.mockClear()
  harness.send.mockClear()
  harness.on.mockClear()
  harness.off.mockClear()
  harness.postMessage.mockClear()
})

describe('preload 다리 — ① 노출', () => {
  it('`exposeInMainWorld` 1회 · 키 `ooBridge` · 다리 키 7', () => {
    expect(harness.exposed.map(([key]) => key)).toEqual(['ooBridge'])
    expect(Object.keys(bridge)).toEqual([
      'invoke',
      'send',
      'on',
      'connectHost',
      'onHostExited',
      'pathForFile',
      'platform'
    ])
  })
})

describe('preload 다리 — ② 셸 채널만 연다', () => {
  it('셸 채널의 요청·송신·구독과 그 해제는 `ipcRenderer` 로 간다', async () => {
    expect(await bridge.invoke(CHANNELS.bootWhenReady)).toBe('answer')
    expect(harness.invoke).toHaveBeenCalledExactlyOnceWith(CHANNELS.bootWhenReady, undefined)
    bridge.send(CHANNELS.logEmit, { level: 'info' })
    expect(harness.send).toHaveBeenCalledExactlyOnceWith(CHANNELS.logEmit, { level: 'info' })
    const handler = vi.fn()
    const off = bridge.on(CHANNELS.updateStateEvent, handler)
    expect(harness.on).toHaveBeenCalledOnce()
    const [channel, listener] = harness.on.mock.calls[0]!
    expect(channel).toBe(CHANNELS.updateStateEvent)
    // Electron 이벤트 객체는 넘기지 않는다.
    listener({ sender: 'event' }, { state: 'idle' })
    expect(handler).toHaveBeenCalledExactlyOnceWith({ state: 'idle' })
    off()
    expect(harness.off).toHaveBeenCalledExactlyOnceWith(CHANNELS.updateStateEvent, listener)
  })

  it.each([
    ['에이전트 채널 요청', () => bridge.invoke(CHANNELS.chatSend)],
    ['데이터 채널 송신', () => bridge.send(CHANNELS.sessionLoadCancel, { requestId: 1 })],
    ['에이전트 채널 구독', () => bridge.on(CHANNELS.chatEvent, () => {})],
    ['표에 없는 이름', () => bridge.invoke('oo:nope')]
  ])('%s → 던진다 · `ipcRenderer` 호출 0', (_name, call) => {
    expect(call).toThrow()
    expect(harness.invoke).not.toHaveBeenCalled()
    expect(harness.send).not.toHaveBeenCalled()
    expect(harness.on).not.toHaveBeenCalled()
  })
})

describe('preload 다리 — ③ 포트 전달', () => {
  it('셸이 넘긴 에이전트 포트를 같은 창의 메인 월드로 넘긴다', () => {
    const port = { id: 'agent-port' }
    fromShell(HOST_PORT_CHANNEL, { host: 'agent' }, [port])
    expect(harness.postMessage).toHaveBeenCalledExactlyOnceWith(
      { type: HOST_PORT_MESSAGE, host: 'agent' },
      '*',
      [port]
    )
  })

  it.each([
    ['호스트 없음', {}, [{}]],
    ['셸', { host: 'shell' }, [{}]],
    ['포트 0', { host: 'data' }, []],
    // 0324 EP-26′ ③ — "포트 1 일 때만" 의 다른 쪽.
    ['포트 2', { host: 'agent' }, [{}, {}]]
  ])('%s → 넘기지 않는다', (_name, payload, ports) => {
    fromShell(HOST_PORT_CHANNEL, payload, ports)
    expect(harness.postMessage).not.toHaveBeenCalled()
  })
})

describe('preload 다리 — ④ 연결 요청', () => {
  it.each(['all', 'agent', 'data'] as const)('`connectHost(%s)` → 셸 연결 채널 1', (host) => {
    bridge.connectHost(host)
    expect(harness.send).toHaveBeenCalledExactlyOnceWith(HOST_CONNECT_CHANNEL, { host })
  })

  it('셸은 연결 대상이 아니다 — 던진다 · 송신 0', () => {
    expect(() => bridge.connectHost('shell' as 'all')).toThrow()
    expect(harness.send).not.toHaveBeenCalled()
  })
})

describe('preload 다리 — ⑤ 종료 통지', () => {
  it('에이전트·데이터의 종료만 전달하고 해제 뒤에는 전달하지 않는다', () => {
    const handler = vi.fn()
    const off = bridge.onHostExited(handler)
    fromShell(HOST_EXITED_CHANNEL, { host: 'data' })
    fromShell(HOST_EXITED_CHANNEL, { host: 'x' })
    off()
    fromShell(HOST_EXITED_CHANNEL, { host: 'agent' })
    expect(handler.mock.calls).toEqual([['data']])
  })
})

describe('preload 다리 — ⑥ 파일 경로 · ⑦ platform', () => {
  it('파일 경로는 `webUtils.getPathForFile` 의 값이다', () => {
    const file = { name: 'picked.txt' } as File
    expect(bridge.pathForFile(file)).toBe('C:/picked.txt')
    expect(harness.getPathForFile).toHaveBeenCalledExactlyOnceWith(file)
  })

  it('platform 은 `process.platform` 이다', () => {
    expect(bridge.platform).toBe(process.platform)
  })
})
