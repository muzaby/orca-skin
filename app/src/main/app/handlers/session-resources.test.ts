import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { NativeResource, NativeResources } from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { ProjectResourceSync } from '../project-resource-sync'
import { registerSessionResourceHandlers } from './session-resources'
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
it('returns pending configuration as read-only through the real IPC read', async () => {
  const runtime = {
    nativeResources: async () => snapshot()
  } as unknown as GovernedLiveTurn
  const target = {
    backend: 'claude' as const,
    cwd: 'C:/work',
    key: 'work',
    request: { sessionId: request.sessionId },
    runtime
  }
  let read!: ReturnType<typeof registerSessionResourceHandlers>
  const sync = new ProjectResourceSync({
    resolve: () => target,
    targets: () => [target],
    policy: () => ({ files: () => [], read: async () => ({ revision: 'external' }) }),
    idle: () => false,
    emit: vi.fn(),
    read: (request) => read(request)
  })
  try {
    read = registerSessionResourceHandlers({ lookup: () => runtime, projectSync: sync })
    sync.tick()
    for (let i = 0; i < 40; i++) await Promise.resolve()
    expect(
      await invoke(CHANNELS.sessionNativeResources, { sessionId: request.sessionId })
    ).toMatchObject({
      configurationPending: true,
      items: [{ enabled: true, status: 'connected', canToggle: false }]
    })
  } finally {
    sync.close()
  }
})
it('acquires a scoped observer without an SDK query and releases it on renderer teardown', async () => {
  const scope = { backend: 'claude' as const, cwd: 'C:/work/A', projectId: null }
  let revision = 'one',
    changed!: () => void
  const stop = vi.fn(),
    send = vi.fn(),
    sdk = vi.fn(async () => snapshot())
  const sender = Object.assign(new EventEmitter(), { id: 4, isDestroyed: () => false, send })
  const readConfigured = vi.fn(async () => snapshot().items)
  let read!: ReturnType<typeof registerSessionResourceHandlers>
  const sync = new ProjectResourceSync({
    resolve: (request) => ({ backend: 'claude', cwd: scope.cwd, key: scope.cwd, request }),
    targets: () => [],
    policy: () => ({ files: () => ['settings'], read: async () => ({ revision }) }),
    idle: () => true,
    emit: vi.fn(),
    read: (request) => read(request),
    watch: (_file, callback) => {
      changed = callback
      return stop
    }
  })
  try {
    read = registerSessionResourceHandlers({
      lookup: () => ({ nativeResources: sdk }) as unknown as GovernedLiveTurn,
      draftResources: readConfigured,
      projectSync: sync
    })
    const observe = (active: boolean): Promise<unknown> =>
      callbacks.get(CHANNELS.sessionNativeResources)!(
        { sender },
        { ...scope, observation: { owner: 'panel', active } }
      )
    await observe(true)
    for (let i = 0; i < 30; i++) await Promise.resolve()
    expect(sdk).not.toHaveBeenCalled()
    expect(send).toHaveBeenLastCalledWith(CHANNELS.sessionNativeResourcesChanged, {
      scope,
      resources: expect.objectContaining({
        state: 'disconnected',
        items: [expect.objectContaining({ canToggle: false })]
      })
    })
    send.mockClear()
    revision = 'external'
    changed()
    for (let i = 0; i < 30; i++) await Promise.resolve()
    expect(send).toHaveBeenCalledOnce()
    await observe(false)
    expect(stop).toHaveBeenCalledOnce()
    await observe(true)
    sender.emit('destroyed')
    expect(stop).toHaveBeenCalledTimes(2)
  } finally {
    sync.close()
  }
})
describe('native resource IPC', () => {
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
      registerSessionResourceHandlers({
        lookup: () => runtime,
        configuredResources: async () => items
      })
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
    registerSessionResourceHandlers({
      lookup: () => runtime,
      configuredResources: async () => {
        throw new Error('secret path')
      }
    })
    expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual({
      ...snapshot(),
      partial: true
    })
  })
  it('merges live resources with offline configuration and preserves configured descriptions', async () => {
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
    registerSessionResourceHandlers({ lookup: () => runtime, configuredResources: inventory })
    expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual({
      state: 'disconnected',
      pluginsAuthoritative: true,
      items: configured
    })
    expect(inventory).toHaveBeenCalledWith('session-B')
    const live = snapshot()
    live.items.push({ ...configured[2], name: 'Loaded plugin', status: 'enabled' })
    delete live.items[1].description
    runtime = {
      nativeResources: async () => live
    } as unknown as GovernedLiveTurn
    const initial = (await invoke(CHANNELS.sessionNativeResources, {
      sessionId: 'session-B'
    })) as NativeResources
    expect(initial.items).toHaveLength(3)
    expect(initial.items[0]).toEqual(live.items[0])
    expect(initial.items[2].status).toBe('enabled')
    const result = (await invoke(CHANNELS.sessionNativeResources, {
      sessionId: 'session-B'
    })) as NativeResources
    expect(result.items).toEqual([
      live.items[0],
      configured[1],
      { ...live.items[1], description: 'Installed plugin skills' }
    ])
  })

  it('rejects failed discovery and runtime replacement during configuration reads', async () => {
    registerSessionResourceHandlers({
      lookup: () => undefined,
      configuredResources: async () => {
        throw new Error('discovery failed')
      }
    })
    await expect(
      invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })
    ).rejects.toThrow('불러오지 못했습니다')
    let finish!: (items: NativeResource[]) => void
    let runtime: GovernedLiveTurn | undefined = undefined
    registerSessionResourceHandlers({
      lookup: () => runtime,
      configuredResources: () =>
        new Promise((resolve) => {
          finish = resolve
        })
    })
    const pending = invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })
    await Promise.resolve()
    runtime = {} as GovernedLiveTurn
    finish([])
    await expect(pending).rejects.toThrow('바뀌었습니다')
  })
  it('resolves the current session and reads its live resources', async () => {
    const nativeResources = vi.fn(async () => snapshot())
    const runtime = { nativeResources } as unknown as GovernedLiveTurn
    const lookup = vi.fn((id: string) => (id === 'session-B' ? runtime : undefined))
    registerSessionResourceHandlers({ lookup: lookup })
    expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'absent' })).toEqual({
      state: 'disconnected',
      items: []
    })
    expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'session-B' })).toEqual(
      snapshot()
    )
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
  registerSessionResourceHandlers({ lookup: () => runtime, configuredCommands: commands })
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
  registerSessionResourceHandlers({ lookup: lookup, draftCommands: draft })
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
})

it('treats a fresh registry as authoritative over live plugins', async () => {
  const plugin: NativeResource = {
    id: 'installed',
    kind: 'plugin',
    name: 'Installed',
    status: 'configured',
    enabled: true,
    canToggle: false
  }
  const runtime = {
    nativeResources: async () => ({ ...snapshot(), items: [plugin, { ...plugin, id: 'removed' }] })
  } as unknown as GovernedLiveTurn
  const inventory = vi.fn<() => Promise<NativeResource[] | undefined>>().mockResolvedValue([plugin])
  registerSessionResourceHandlers({ lookup: () => runtime, configuredResources: inventory })
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'B' })).toMatchObject({
    pluginsAuthoritative: true,
    items: [plugin]
  })
  inventory.mockResolvedValue([])
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'B' })).toMatchObject({
    pluginsAuthoritative: true,
    items: []
  })
  runtime.nativeResources = async () => ({
    ...snapshot(),
    items: [plugin, { ...plugin, id: 'removed' }]
  })
  inventory.mockResolvedValue(undefined)
  expect(await invoke(CHANNELS.sessionNativeResources, { sessionId: 'B' })).toMatchObject({
    items: [plugin, { ...plugin, id: 'removed' }]
  })
})

it('lists draft installations without looking up a session', async () => {
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
    registerSessionResourceHandlers({ lookup: lookup, draftResources: inventory })
    const scope = { backend: 'claude', cwd: directory, projectId: 'draft-project' }
    expect(await invoke(CHANNELS.sessionNativeResources, scope)).toEqual({
      state: 'disconnected',
      items: [{ ...plugin, canToggle: false }],
      commands: [],
      pluginsAuthoritative: true
    })
    expect(lookup).not.toHaveBeenCalled()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('retains live observations only while the same provider generation survives metadata failures', async () => {
  const state = snapshot()
  state.composer = {
    agents: [{ name: 'plugin-review' }],
    models: [{ id: 'plugin/reasoner', variants: ['deep'] }]
  }
  state.items[0] = { ...state.items[0], enabled: false, status: 'disabled' }
  const live = vi.fn<() => Promise<NativeResources>>().mockResolvedValue(state)
  const runtime = { providerGeneration: 'generation-B', nativeResources: live }
  registerSessionResourceHandlers({ lookup: () => runtime as unknown as GovernedLiveTurn })
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
