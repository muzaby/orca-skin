import { afterEach, expect, it, vi } from 'vitest'
import { CHANNELS, type HarnessAvailability } from '../shared/ipc'
const ipc = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn()
}))
vi.mock('electron', () => ({
  ipcRenderer: ipc,
  contextBridge: { exposeInMainWorld: vi.fn() },
  webUtils: {}
}))
afterEach(() => vi.unstubAllGlobals())
it('carries availability changes and invokes recheck with the requested harness', async () => {
  vi.stubGlobal('window', {})
  await import('./index')
  const state: HarnessAvailability = {
    id: 'opencode',
    installed: false,
    usable: false,
    unavailableReason: 'missing'
  }
  const received = vi.fn(),
    stop = window.oo.harness.onAvailability(received)
  const [channel, listener] = ipc.on.mock.calls.at(-1)!
  expect(channel).toBe(CHANNELS.harnessAvailability)
  listener({}, state)
  expect(received).toHaveBeenCalledExactlyOnceWith(state)
  ipc.invoke.mockResolvedValue(state)
  expect(await window.oo.harness.recheck('opencode')).toBe(state)
  expect(ipc.invoke).toHaveBeenCalledWith(CHANNELS.harnessRecheck, { backend: 'opencode' })
  stop()
  expect(ipc.removeListener).toHaveBeenCalledWith(channel, listener)
})
