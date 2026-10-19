import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { NativeResources } from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
const callbacks = vi.hoisted(
  () => new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
)
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, callback: (event: unknown, payload: unknown) => Promise<unknown>) =>
      callbacks.set(name, callback)
  }
}))
import { registerSessionResourceHandlers } from './session-resources'

const request = {
  sessionId: 'session-B',
  generation: 'generation-B',
  kind: 'mcp',
  id: 'server-A',
  enabled: false
}
const snapshot = (): NativeResources => ({
  state: 'connected',
  generation: 'generation-B',
  items: [
    {
      id: 'server-A',
      name: 'native',
      kind: 'mcp',
      status: 'connected',
      enabled: true,
      canToggle: true
    }
  ]
})
const invoke = (channel: string, payload: unknown): Promise<unknown> =>
  callbacks.get(channel)!({}, payload)
beforeEach(() => callbacks.clear())
describe('native resource IPC', () => {
  it('validates input, resolves the current session and carries toggle fields and refreshed state', async () => {
    const nativeResources = vi.fn(async () => snapshot())
    const setNativeResource = vi.fn(async () => {})
    const runtime = { nativeResources, setNativeResource } as unknown as GovernedLiveTurn
    const lookup = vi.fn((id: string) => (id === 'session-B' ? runtime : undefined))
    registerSessionResourceHandlers(lookup)
    expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'absent' })).toEqual({
      state: 'disconnected',
      items: []
    })
    expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual(
      snapshot()
    )
    expect(await invoke(CHANNELS.sessionSetNativeResource, request)).toEqual(snapshot())
    expect(setNativeResource).toHaveBeenCalledExactlyOnceWith(request)
    await invoke(CHANNELS.sessionSetNativeResource, { ...request, enabled: true })
    expect(setNativeResource).toHaveBeenLastCalledWith({ ...request, enabled: true })
    for (const invalid of [
      { ...request, enabled: 'false' },
      { ...request, generation: '' },
      { ...request, kind: 'orca' },
      { ...request, sessionId: '' }
    ])
      await expect(invoke(CHANNELS.sessionSetNativeResource, invalid)).rejects.toThrow()
    expect(setNativeResource).toHaveBeenCalledTimes(2)
  })
  it('rejects stale generations, unknown entries and read-only resources before writing', async () => {
    const current = snapshot()
    const write = vi.fn()
    registerSessionResourceHandlers(
      () =>
        ({
          nativeResources: async () => current,
          setNativeResource: write
        }) as unknown as GovernedLiveTurn
    )
    // Stable identity is required even before the resource capability check.
    const runtime = {
      nativeResources: async () => current,
      setNativeResource: write
    } as unknown as GovernedLiveTurn
    registerSessionResourceHandlers(() => runtime)
    await expect(
      invoke(CHANNELS.sessionSetNativeResource, { ...request, generation: 'old' })
    ).rejects.toThrow('바뀌었습니다')
    await expect(
      invoke(CHANNELS.sessionSetNativeResource, { ...request, id: 'missing' })
    ).rejects.toThrow('지원하지')
    current.items[0].canToggle = false
    await expect(invoke(CHANNELS.sessionSetNativeResource, request)).rejects.toThrow('지원하지')
    current.items[0].kind = 'plugin'
    await expect(
      invoke(CHANNELS.sessionSetNativeResource, { ...request, kind: 'plugin' })
    ).rejects.toThrow('지원하지')
    expect(write).not.toHaveBeenCalled()
  })
  it('rejects a replaced runtime during read and before mutation', async () => {
    let finish!: (value: NativeResources) => void
    const write = vi.fn()
    let runtime: GovernedLiveTurn | undefined = {
      nativeResources: () =>
        new Promise<NativeResources>((resolve) => {
          finish = resolve
        }),
      setNativeResource: write
    } as unknown as GovernedLiveTurn
    registerSessionResourceHandlers(() => runtime)
    const pending = invoke(CHANNELS.sessionSetNativeResource, request)
    runtime = undefined
    finish(snapshot())
    await expect(pending).rejects.toThrow('바뀌었습니다')
    expect(write).not.toHaveBeenCalled()
  })
})
