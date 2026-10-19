import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { NativeResource, NativeResources } from '../../../shared/native-resources'
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
  it('shows offline configuration and preserves it after live toggles without enabling configured-only writes', async () => {
    const configured: NativeResource[] = [
      { ...snapshot().items[0], status: 'configured', canToggle: false },
      {
        id: 'only-config',
        name: 'Configured',
        kind: 'mcp',
        status: 'configured',
        enabled: true,
        canToggle: false
      },
      {
        id: 'plugin-key',
        name: 'Native plugin',
        kind: 'plugin',
        status: 'configured',
        enabled: true,
        canToggle: false
      }
    ]
    let runtime: GovernedLiveTurn | undefined = undefined
    const inventory = vi.fn(async () => configured)
    registerSessionResourceHandlers(() => runtime, inventory)
    expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual({
      state: 'disconnected',
      items: configured
    })
    expect(inventory).toHaveBeenCalledWith('session-B')
    await expect(invoke(CHANNELS.sessionSetNativeResource, request)).rejects.toThrow(
      '연결되어 있지'
    )
    const live = snapshot()
    live.items.push({ ...configured[2], name: 'Loaded plugin', status: 'enabled' })
    const write = vi.fn(async () => {
      live.items[0] = { ...live.items[0], enabled: false, status: 'disabled' }
    })
    runtime = {
      nativeResources: async () => live,
      setNativeResource: write
    } as unknown as GovernedLiveTurn
    const initial = (await invoke(CHANNELS.sessionNativeResources, {
      sessionId: 'session-B'
    })) as NativeResources
    expect(initial.items).toHaveLength(3)
    expect(initial.items[0]).toEqual(live.items[0])
    expect(initial.items[2].status).toBe('enabled')
    await expect(
      invoke(CHANNELS.sessionSetNativeResource, { ...request, id: 'only-config' })
    ).rejects.toThrow('지원하지')
    expect(write).not.toHaveBeenCalled()
    const result = (await invoke(CHANNELS.sessionSetNativeResource, request)) as NativeResources
    expect(result.items).toEqual([live.items[0], configured[1], live.items[1]])
    expect(write).toHaveBeenCalledOnce()
  })

  it('rejects failed discovery and runtime replacement during configuration reads', async () => {
    registerSessionResourceHandlers(
      () => undefined,
      async () => {
        throw new Error('discovery failed')
      }
    )
    await expect(
      invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })
    ).rejects.toThrow('discovery failed')
    let finish!: (items: NativeResource[]) => void
    let runtime: GovernedLiveTurn | undefined = undefined
    registerSessionResourceHandlers(
      () => runtime,
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })
    runtime = {} as GovernedLiveTurn
    finish([])
    await expect(pending).rejects.toThrow('바뀌었습니다')
  })
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
