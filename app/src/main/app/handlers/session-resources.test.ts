import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { NativeResource, NativeResources } from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const openPath = vi.hoisted(() => vi.fn(async () => ''))
const callbacks = vi.hoisted(
  () => new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
)
vi.mock('electron', () => ({
  shell: { openPath },
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
afterEach(() => vi.useRealTimers())
describe('native resource IPC', () => {
  it('opens only a resolved installed directory and rejects arbitrary paths, files and shell errors', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'orca-plugin-open-'))
    try {
      const lookup = vi.fn(async (sessionId: string, id: string) =>
        sessionId === 'B' && id === 'plugin:hash' ? directory : undefined
      )
      registerSessionResourceHandlers(() => undefined, undefined, lookup)
      openPath.mockClear().mockResolvedValue('')
      await invoke(CHANNELS.sessionOpenNativePlugin, { sessionId: 'B', id: 'plugin:hash' })
      expect(openPath).toHaveBeenCalledExactlyOnceWith(await realpath(directory))
      expect(lookup).toHaveBeenCalledExactlyOnceWith('B', 'plugin:hash')
      for (const payload of [
        { sessionId: 'B', id: directory },
        { sessionId: 'other', id: 'plugin:hash' },
        { sessionId: 'B', id: 'plugin:hash', path: directory }
      ])
        await expect(invoke(CHANNELS.sessionOpenNativePlugin, payload)).rejects.toThrow()
      expect(openPath).toHaveBeenCalledTimes(1)
      openPath.mockResolvedValueOnce('private path error')
      await expect(
        invoke(CHANNELS.sessionOpenNativePlugin, { sessionId: 'B', id: 'plugin:hash' })
      ).rejects.toThrow('설치 폴더')
      const file = join(directory, 'plugin.exe')
      await writeFile(file, '')
      lookup.mockResolvedValueOnce(file)
      await expect(
        invoke(CHANNELS.sessionOpenNativePlugin, { sessionId: 'B', id: 'plugin:hash' })
      ).rejects.toThrow('설치 폴더')
      expect(openPath).toHaveBeenCalledTimes(2)
      const runtime = {
        nativePluginDirectory: vi.fn(async () => directory)
      } as unknown as GovernedLiveTurn
      registerSessionResourceHandlers(() => runtime, undefined, lookup)
      await invoke(CHANNELS.sessionOpenNativePlugin, { sessionId: 'C', id: 'live-plugin' })
      expect(runtime.nativePluginDirectory).toHaveBeenCalledWith('live-plugin')
      expect(openPath).toHaveBeenCalledTimes(3)
      const changingRuntime = vi.fn().mockReturnValueOnce(runtime).mockReturnValue(undefined)
      registerSessionResourceHandlers(changingRuntime, undefined, lookup)
      await expect(
        invoke(CHANNELS.sessionOpenNativePlugin, { sessionId: 'C', id: 'live-plugin' })
      ).rejects.toThrow('설치 폴더')
      expect(openPath).toHaveBeenCalledTimes(3)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
  it.each(['pending', 'failed'])(
    'returns configured resources when live metadata is %s and reads freshly on reentry',
    async (mode) => {
      vi.useFakeTimers()
      const items = [{ ...snapshot().items[0], status: 'configured' as const, canToggle: false }]
      const live = vi
        .fn<() => Promise<NativeResources>>()
        .mockImplementation(() =>
          mode === 'pending' ? new Promise(() => {}) : Promise.reject(new Error('private error'))
        )
      const runtime = { nativeResources: live } as unknown as GovernedLiveTurn
      registerSessionResourceHandlers(
        () => runtime,
        async () => items
      )
      const pending = invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })
      await vi.advanceTimersByTimeAsync(3001)
      expect(await pending).toEqual({ state: 'disconnected', items, partial: true })
      live.mockResolvedValueOnce(snapshot())
      expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual(
        snapshot()
      )
    }
  )

  it('keeps live resources when configuration fails without exposing the private error', async () => {
    const runtime = { nativeResources: async () => snapshot() } as unknown as GovernedLiveTurn
    registerSessionResourceHandlers(
      () => runtime,
      async () => {
        throw new Error('secret path')
      }
    )
    expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual({
      ...snapshot(),
      partial: true
    })
  })
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
        description: 'Installed plugin skills',
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
    delete live.items[1].description
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
    expect(result.items).toEqual([
      live.items[0],
      configured[1],
      { ...live.items[1], description: 'Installed plugin skills' }
    ])
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
    ).rejects.toThrow('불러오지 못했습니다')
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
    await Promise.resolve()
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
    await Promise.resolve()
    runtime = undefined
    finish(snapshot())
    await expect(pending).rejects.toThrow('바뀌었습니다')
    expect(write).not.toHaveBeenCalled()
  })
})

it('offers installed skills offline and replaces them with authoritative live commands', async () => {
  const installed = [
    {
      name: 'frontend-design:frontend-design',
      description: 'Design',
      argumentHint: '[brief]',
      source: 'plugin' as const
    }
  ]
  let runtime: GovernedLiveTurn | undefined
  const commands = vi.fn(async () => installed)
  registerSessionResourceHandlers(() => runtime, undefined, undefined, commands)
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toMatchObject({
    state: 'disconnected',
    commands: installed
  })
  expect(commands).toHaveBeenCalledWith('session-B')
  commands.mockResolvedValueOnce([])
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toMatchObject({
    commands: []
  })
  runtime = {
    nativeResources: async () => ({ ...snapshot(), commands: [] })
  } as unknown as GovernedLiveTurn
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toMatchObject({
    commands: []
  })
  runtime = {
    nativeResources: async () => {
      throw new Error('unavailable')
    }
  } as unknown as GovernedLiveTurn
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toMatchObject({
    commands: installed,
    partial: true
  })
})

it('accepts only a read-only draft scope and never looks up or controls a live session', async () => {
  const lookup = vi.fn()
  const commands = [
    {
      name: 'frontend-design:frontend-design',
      description: 'Design',
      argumentHint: '',
      source: 'plugin' as const
    }
  ]
  const draft = vi.fn(async () => commands)
  registerSessionResourceHandlers(lookup, undefined, undefined, undefined, draft)
  const request = { backend: 'claude', cwd: 'C:/work-B', projectId: 'project-B' }
  expect(await invoke(CHANNELS.sessionNativeResources, request)).toEqual({
    state: 'disconnected',
    items: [],
    commands
  })
  expect(draft).toHaveBeenCalledExactlyOnceWith(request)
  expect(lookup).not.toHaveBeenCalled()
  await expect(
    invoke(CHANNELS.sessionNativeResources, { ...request, sessionId: 'session-B' })
  ).rejects.toThrow()
  await expect(
    invoke(CHANNELS.sessionNativeResources, { ...request, backend: 'unknown' })
  ).rejects.toThrow()
  await expect(
    invoke(CHANNELS.sessionSetNativeResource, {
      ...request,
      id: 'x',
      kind: 'mcp',
      enabled: true,
      generation: 'x'
    })
  ).rejects.toThrow()
})
