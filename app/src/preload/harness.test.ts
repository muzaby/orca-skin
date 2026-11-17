import { afterEach, expect, it, vi } from 'vitest'
import { CHANNELS, type HarnessAvailability } from '../shared/ipc'
import { HOST_PORT_CHANNEL } from '../shared/host-protocol'
const ipc = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  send: vi.fn()
}))
vi.mock('electron', () => ({
  ipcRenderer: ipc,
  contextBridge: { exposeInMainWorld: vi.fn() },
  webUtils: {}
}))
afterEach(() => vi.unstubAllGlobals())
// 하네스 가용성 통지와 재확인은 에이전트 호스트 채널이다 — 셸이 넘긴 에이전트 포트로 오간다(0324 AC24′).
it('carries availability changes and invokes recheck with the requested harness over the agent port', async () => {
  vi.stubGlobal('window', {})
  await import('./index')
  const posted: Array<{ kind: string; id?: number; channel: string; payload?: unknown }> = []
  let onmessage: (event: { data: unknown }) => void = () => {}
  const port = {
    set onmessage(listener: (event: { data: unknown }) => void) {
      onmessage = listener
    },
    postMessage: (message: (typeof posted)[number]) => posted.push(message),
    close: vi.fn()
  }
  const deliver = ipc.on.mock.calls.find(([channel]) => channel === HOST_PORT_CHANNEL)![1]
  deliver({ ports: [port] }, { host: 'agent' })
  const state: HarnessAvailability = {
    id: 'opencode',
    installed: false,
    usable: false,
    unavailableReason: 'missing'
  }
  const received = vi.fn(),
    stop = window.oo.harness.onAvailability(received)
  onmessage({ data: { kind: 'event', channel: CHANNELS.harnessAvailability, payload: state } })
  expect(received).toHaveBeenCalledExactlyOnceWith(state)
  const recheck = window.oo.harness.recheck('opencode')
  expect(posted.at(-1)).toMatchObject({
    kind: 'invoke',
    channel: CHANNELS.harnessRecheck,
    payload: { backend: 'opencode' }
  })
  onmessage({ data: { kind: 'result', id: posted.at(-1)!.id, ok: true, value: state } })
  expect(await recheck).toEqual(state)
  expect(ipc.invoke).not.toHaveBeenCalled()
  stop()
  onmessage({ data: { kind: 'event', channel: CHANNELS.harnessAvailability, payload: state } })
  expect(received).toHaveBeenCalledOnce()
})
