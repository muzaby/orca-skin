import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type {
  NativeResource,
  NativeResources,
  SetNativeResource
} from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const openPath = vi.hoisted(() => vi.fn(async () => ''))
const showItemInFolder = vi.hoisted(() => vi.fn())
const callbacks = vi.hoisted(
  () => new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
)
vi.mock('electron', () => ({
  shell: { openPath, showItemInFolder },
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
  it('reveals only the resolved MCP configuration file for saved and draft requests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'orca-mcp-reveal-'))
    const file = join(directory, '.mcp.json')
    try {
      await writeFile(file, '{}')
      const resolve = vi.fn(async () => file)
      registerSessionResourceHandlers(
        () => undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        resolve
      )
      showItemInFolder.mockClear()
      const requests = [
        { sessionId: 'saved-B', id: 'server-B', kind: 'mcp' },
        { backend: 'opencode', cwd: directory, projectId: null, id: 'server-C', kind: 'mcp' }
      ]
      for (const request of requests) {
        await invoke(CHANNELS.sessionOpenNativePlugin, request)
        expect(resolve).toHaveBeenLastCalledWith(request, request.id)
        expect(showItemInFolder).toHaveBeenLastCalledWith(await realpath(file))
      }
      expect(showItemInFolder).toHaveBeenCalledTimes(2)
      await expect(
        invoke(CHANNELS.sessionOpenNativePlugin, {
          ...requests[0],
          path: file
        })
      ).rejects.toThrow()
      resolve.mockResolvedValueOnce(directory)
      await expect(invoke(CHANNELS.sessionOpenNativePlugin, requests[0])).rejects.toThrow(
        '설정 파일'
      )
      expect(showItemInFolder).toHaveBeenCalledTimes(2)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
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
      expect(await pending).toEqual({
        state: 'disconnected',
        items,
        partial: true,
        pluginsAuthoritative: true
      })
      live.mockResolvedValueOnce(snapshot())
      expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual({
        ...snapshot(),
        pluginsAuthoritative: true
      })
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
      pluginsAuthoritative: true,
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
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
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

it('treats a fresh registry as authoritative over live plugins and refuses removed install paths', async () => {
  const plugin: NativeResource = {
    id: 'installed',
    kind: 'plugin',
    name: 'Installed',
    status: 'configured',
    enabled: true,
    canToggle: false
  }
  const runtime = {
    nativeResources: async () => ({ ...snapshot(), items: [plugin, { ...plugin, id: 'removed' }] }),
    nativePluginDirectory: vi.fn(async () => '/stale-live-path')
  } as unknown as GovernedLiveTurn
  const inventory = vi.fn<() => Promise<NativeResource[] | undefined>>().mockResolvedValue([plugin])
  registerSessionResourceHandlers(() => runtime, inventory)
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'B' })).toMatchObject({
    pluginsAuthoritative: true,
    items: [plugin]
  })
  inventory.mockResolvedValue([])
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'B' })).toMatchObject({
    pluginsAuthoritative: true,
    items: []
  })
  await expect(
    invoke(CHANNELS.sessionOpenNativePlugin, { sessionId: 'B', id: 'removed' })
  ).rejects.toThrow('설치 폴더')
  expect(runtime.nativePluginDirectory).not.toHaveBeenCalled()
  const write = vi.fn(async () => {})
  runtime.setNativeResource = write
  runtime.nativeResources = async () => ({ ...snapshot(), items: [{ ...plugin, canToggle: true }] })
  await expect(
    invoke(CHANNELS.sessionSetNativeResource, {
      sessionId: 'B',
      generation: 'generation-B',
      kind: 'plugin',
      id: 'installed',
      enabled: false
    })
  ).rejects.toThrow('현재 작업 경로')
  expect(write).not.toHaveBeenCalled()
  runtime.nativeResources = async () => ({
    ...snapshot(),
    items: [plugin, { ...plugin, id: 'removed' }]
  })
  inventory.mockResolvedValue(undefined)
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'B' })).toMatchObject({
    items: [plugin, { ...plugin, id: 'removed' }]
  })
})

it('lists draft installations and opens their resolved folder without a session or write permission', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-draft-plugin-'))
  try {
    const plugin: NativeResource = {
      id: 'draft-plugin',
      name: 'Native',
      kind: 'plugin',
      status: 'disabled',
      enabled: false,
      canToggle: true
    }
    const lookup = vi.fn()
    const inventory = vi.fn(async () => [plugin])
    const resolver = vi.fn(async () => directory)
    registerSessionResourceHandlers(
      lookup,
      undefined,
      undefined,
      undefined,
      undefined,
      inventory,
      resolver
    )
    const scope = { backend: 'claude', cwd: directory, projectId: 'draft-project' }
    expect(await invoke(CHANNELS.sessionNativeResources, scope)).toEqual({
      state: 'disconnected',
      items: [{ ...plugin, canToggle: false }],
      commands: [],
      pluginsAuthoritative: true
    })
    openPath.mockClear().mockResolvedValue('')
    await invoke(CHANNELS.sessionOpenNativePlugin, { ...scope, id: plugin.id })
    expect(resolver).toHaveBeenCalledWith({ ...scope, id: plugin.id }, plugin.id)
    expect(openPath).toHaveBeenCalledExactlyOnceWith(await realpath(directory))
    for (const payload of [
      { ...scope, id: plugin.id, sessionId: 'mix' },
      { ...scope, id: plugin.id, path: directory }
    ])
      await expect(invoke(CHANNELS.sessionOpenNativePlugin, payload)).rejects.toThrow()
    expect(lookup).not.toHaveBeenCalled()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('retains live observations only while the same provider generation survives metadata failures', async () => {
  const state = snapshot()
  state.items[0] = { ...state.items[0], enabled: false, status: 'disabled' }
  const live = vi.fn<() => Promise<NativeResources>>().mockResolvedValue(state)
  const runtime = { providerGeneration: 'generation-B', nativeResources: live }
  registerSessionResourceHandlers(() => runtime as unknown as GovernedLiveTurn)
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual(state)
  live.mockRejectedValue(new Error('metadata unavailable'))
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual({
    ...state,
    partial: true
  })
  runtime.providerGeneration = 'generation-next'
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual({
    state: 'connected',
    generation: 'generation-next',
    items: [],
    partial: true
  })
  Object.assign(runtime, { providerGeneration: undefined })
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual({
    state: 'disconnected',
    items: [],
    partial: true
  })
})

it.each([false, true])(
  'serializes per-runtime SDK writes and continues after a rejection (%s)',
  async (rejectFirst) => {
    const state = snapshot()
    const second = { ...state.items[0], id: 'server-C' }
    state.items.push(second)
    let finish!: () => void
    let fail!: (error: Error) => void
    const started = Promise.withResolvers<void>()
    const write = vi
      .fn<(req: typeof request) => Promise<void>>()
      .mockImplementationOnce(() => {
        started.resolve()
        return new Promise((resolve, reject) => {
          finish = resolve
          fail = reject
        })
      })
      .mockResolvedValue(undefined)
    const runtime = {
      nativeResources: async () => state,
      setNativeResource: write
    } as unknown as GovernedLiveTurn
    registerSessionResourceHandlers(() => runtime)
    const first = invoke(CHANNELS.sessionSetNativeResource, request)
    const firstResult = first.then(
      () => 'resolved',
      () => 'rejected'
    )
    await started.promise
    const next = invoke(CHANNELS.sessionSetNativeResource, { ...request, id: second.id })
    for (let i = 0; i < 8; i++) await Promise.resolve()
    expect(write).toHaveBeenCalledExactlyOnceWith(request)
    if (rejectFirst) fail(new Error('first failed'))
    else finish()
    expect(await firstResult).toBe(rejectFirst ? 'rejected' : 'resolved')
    expect(await next).toEqual(state)
    expect(write.mock.calls.map(([req]) => req.id)).toEqual([request.id, second.id])
  }
)

it.each(['plugin', 'mcp'] as const)(
  'shares %s writes between project peers using each live generation and publishes real results',
  async (kind) => {
    const runtimes = new Map<string, GovernedLiveTurn>()
    const writes: SetNativeResource[] = []
    for (const [id, canToggle] of [
      ['session-B', true],
      ['peer-A', true],
      ['readonly', false],
      ['missing', true]
    ] as const) {
      let enabled = true
      runtimes.set(id, {
        providerGeneration: id + '-generation',
        nativeResources: async () => ({
          state: 'connected',
          generation: id + '-generation',
          items:
            id === 'missing'
              ? []
              : [
                  {
                    ...snapshot().items[0],
                    kind,
                    enabled,
                    canToggle,
                    status: enabled ? 'enabled' : 'disabled'
                  }
                ]
        }),
        setNativeResource: async (value: SetNativeResource) => {
          writes.push(value)
          enabled = value.enabled
        }
      } as GovernedLiveTurn)
    }
    const changed = vi.fn()
    registerSessionResourceHandlers(
      (id) => runtimes.get(id),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        scope: () => 'project-B',
        peers: () => [...runtimes].map(([sessionId, runtime]) => ({ sessionId, runtime })),
        changed
      }
    )
    const result = await invoke(CHANNELS.sessionSetNativeResource, {
      ...request,
      generation: 'session-B-generation',
      kind
    })
    expect(writes).toEqual([
      { ...request, generation: 'session-B-generation', kind },
      { ...request, sessionId: 'peer-A', generation: 'peer-A-generation', kind }
    ])
    expect(result).toMatchObject({ items: [{ enabled: false }] })
    expect(changed.mock.calls.map(([id, value]) => [id, value.items[0].enabled])).toEqual([
      ['session-B', false],
      ['peer-A', false]
    ])
  }
)

it('serializes conflicting project requests and reports peer failures after publishing actual state', async () => {
  const enabled = new Map([
    ['session-B', true],
    ['peer-A', true]
  ])
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const order: string[] = []
  let shouldHold = true,
    failPeer = false
  const runtimes = new Map<string, GovernedLiveTurn>()
  for (const id of enabled.keys())
    runtimes.set(id, {
      providerGeneration: id + '-generation',
      nativeResources: async () => ({
        ...snapshot(),
        generation: id + '-generation',
        items: [{ ...snapshot().items[0], enabled: enabled.get(id)! }]
      }),
      setNativeResource: async (value: SetNativeResource) => {
        order.push(id + ':' + value.enabled)
        if (shouldHold) {
          shouldHold = false
          await held
        }
        if (failPeer && id === 'peer-A') throw new Error('SDK peer failed')
        enabled.set(id, value.enabled)
      }
    } as GovernedLiveTurn)
  const changed = vi.fn()
  registerSessionResourceHandlers(
    (id) => runtimes.get(id),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      scope: () => 'project-B',
      peers: () => [...runtimes].map(([sessionId, runtime]) => ({ sessionId, runtime })),
      changed
    }
  )
  const first = invoke(CHANNELS.sessionSetNativeResource, {
    ...request,
    generation: 'session-B-generation'
  })
  const second = invoke(CHANNELS.sessionSetNativeResource, {
    ...request,
    sessionId: 'peer-A',
    generation: 'peer-A-generation',
    enabled: true
  })
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(order).toEqual(['session-B:false'])
  release()
  await Promise.all([first, second])
  expect([...enabled.values()]).toEqual([true, true])
  expect(order).toEqual(['session-B:false', 'peer-A:false', 'peer-A:true', 'session-B:true'])
  failPeer = true
  await expect(
    invoke(CHANNELS.sessionSetNativeResource, { ...request, generation: 'session-B-generation' })
  ).rejects.toThrow('일부 세션')
  expect(changed.mock.calls.slice(-2).map(([id, value]) => [id, value.items[0].enabled])).toEqual([
    ['session-B', false],
    ['peer-A', true]
  ])
})
