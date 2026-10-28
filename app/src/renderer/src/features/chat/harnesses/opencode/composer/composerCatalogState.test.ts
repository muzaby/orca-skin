import { createComposerAgentStore } from './composerAgentStore'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  ComposerCatalogInvalidated,
  ComposerCatalogRequest,
  ComposerCatalogResult,
  ComposerCatalogScope
} from '../../../../../../../shared/composer-catalog'
import { ComposerCatalogState } from './composerCatalogState'
import { composerModelStore } from './composerModelStore'
const api = vi.hoisted(() => ({
  composerCatalog: vi.fn(),
  releaseComposerCatalog: vi.fn(async () => undefined),
  onOpenCodePluginsChanged: vi.fn(),
  onComposerCatalogInvalidated: vi.fn(),
  onManagedMcpChanged: vi.fn()
}))
vi.mock('../../../../../shared/api/ipc', () => ({ sessionApi: api }))
const scope: ComposerCatalogScope = {
  backend: 'opencode',
  sessionId: null,
  cwd: 'C:/A',
  projectId: null,
  providerKey: 'team',
  agentKind: 'code'
}
const flush = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

it('preserves model and agent flights on MCP-only changes', async () => {
  vi.useFakeTimers()
  const oldModels = Promise.withResolvers<ComposerCatalogResult>()
  const detach = vi.fn()
  api.onManagedMcpChanged.mockReturnValue(detach)
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation(async (request: ComposerCatalogRequest) =>
    request.part === 'agents'
      ? { part: 'agents', generation: 'old-generation', value: [{ name: 'primary-agent' }] }
      : request.refresh
        ? {
            part: 'models',
            generation: 'new-generation',
            value: [{ id: 'fresh-model', variants: ['fresh'] }]
          }
        : oldModels.promise
  )
  const state = new ComposerCatalogState(scope, undefined, createComposerAgentStore(vi.fn()))
  const off = state.subscribe(vi.fn())
  await flush()
  api.onManagedMcpChanged.mock.calls.at(-1)![0]({ revision: 2 })
  await flush()
  oldModels.resolve({
    part: 'models',
    generation: 'old-generation',
    value: [{ id: 'old-model', variants: ['old'] }]
  })
  await flush()
  expect(state.getSnapshot().models).toEqual({
    status: 'ready',
    value: [{ id: 'old-model', variants: ['old'] }]
  })
  expect(api.composerCatalog).toHaveBeenCalledTimes(2)
  expect(state.getSnapshot().agents.value).toEqual([{ name: 'primary-agent' }])
  off()
  await vi.runOnlyPendingTimersAsync()
  expect(detach).toHaveBeenCalledTimes(1)
})
afterEach(() => {
  composerModelStore.clear()
  vi.useRealTimers()
  vi.clearAllMocks()
  api.composerCatalog.mockReset()
})

it('requests the MCP part once on the first intent signal', async () => {
  vi.useFakeTimers()
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) => ({
    part: r.part,
    value: [],
    generation: 'intent'
  }))
  const state = new ComposerCatalogState(scope, undefined, createComposerAgentStore(vi.fn()))
  const off = state.subscribe(vi.fn())
  await flush()
  expect(api.composerCatalog.mock.calls.filter(([r]) => r.part === 'mcp')).toHaveLength(0)
  state.intent()
  state.intent()
  await flush()
  state.intent()
  expect(api.composerCatalog.mock.calls.filter(([r]) => r.part === 'mcp')).toHaveLength(1)
  off()
  await vi.runOnlyPendingTimersAsync()
})

it('seeds stale models for the same profile and replaces them with the live list', async () => {
  vi.useFakeTimers()
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) => ({
    part: r.part,
    value: r.part === 'models' ? [{ id: 'first', variants: ['deep'] }] : [],
    generation: 'first'
  }))
  const first = new ComposerCatalogState(scope, undefined, createComposerAgentStore(vi.fn()))
  const off = first.subscribe(vi.fn())
  await flush()
  off()
  await vi.runOnlyPendingTimersAsync()
  const second = new ComposerCatalogState(
    { ...scope, cwd: 'C:/second' },
    undefined,
    createComposerAgentStore(vi.fn())
  )
  expect(second.getSnapshot().models).toEqual({
    status: 'loading',
    stale: true,
    value: [{ id: 'first', variants: ['deep'] }]
  })
  expect(
    new ComposerCatalogState({ ...scope, providerKey: 'different' }).getSnapshot().models.value
  ).toBeUndefined()
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) => ({
    part: r.part,
    value: r.part === 'models' ? [{ id: 'second', variants: ['quick'] }] : [],
    generation: 'second'
  }))
  const stop = second.subscribe(vi.fn())
  await flush()
  expect(second.getSnapshot().models).toEqual({
    status: 'ready',
    value: [{ id: 'second', variants: ['quick'] }]
  })
  stop()
  await vi.runOnlyPendingTimersAsync()
})

it('publishes agents before models and shares subscribers and remounts', async () => {
  vi.useFakeTimers()
  const models = Promise.withResolvers<ComposerCatalogResult>()
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) =>
    r.part === 'models'
      ? models.promise
      : { part: 'agents', value: [{ name: 'Sisyphus' }], generation: 'g1' }
  )
  const state = new ComposerCatalogState(scope, undefined, createComposerAgentStore(vi.fn()))
  const one = state.subscribe(vi.fn()),
    two = state.subscribe(vi.fn())
  await flush()
  expect(state.getSnapshot()).toEqual({
    agents: { status: 'ready', value: [{ name: 'Sisyphus' }] },
    models: { status: 'loading' }
  })
  expect(api.composerCatalog).toHaveBeenCalledTimes(2)
  one()
  two()
  const again = state.subscribe(vi.fn())
  await vi.runOnlyPendingTimersAsync()
  expect(api.releaseComposerCatalog).not.toHaveBeenCalled()
  expect(api.composerCatalog).toHaveBeenCalledTimes(2)
  models.resolve({
    part: 'models',
    value: [{ id: 'team/model', variants: ['deep'] }],
    generation: 'g1'
  })
  await flush()
  expect(state.getSnapshot().models.value?.[0].variants).toEqual(['deep'])
  again()
  await vi.runOnlyPendingTimersAsync()
  expect(api.releaseComposerCatalog).toHaveBeenCalledExactlyOnceWith(
    api.composerCatalog.mock.calls[0][0].owner
  )
})

it('coalesces retry, keeps data on error and accepts successful empty data', async () => {
  vi.useFakeTimers()
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) => ({
    part: r.part,
    value: r.part === 'models' ? [{ id: 'team/model', variants: ['deep'] }] : [],
    generation: 'g'
  }))
  const state = new ComposerCatalogState(scope, undefined, createComposerAgentStore(vi.fn())),
    remove = state.subscribe(vi.fn())
  await flush()
  const gate = Promise.withResolvers<ComposerCatalogResult>()
  api.composerCatalog.mockReturnValueOnce(gate.promise)
  state.retry('models')
  state.retry('models')
  expect(api.composerCatalog).toHaveBeenCalledTimes(3)
  gate.reject(new Error('offline'))
  await flush()
  expect(state.getSnapshot().models).toEqual({
    status: 'error',
    value: [{ id: 'team/model', variants: ['deep'] }]
  })
  api.composerCatalog.mockResolvedValueOnce({ part: 'models', value: [], generation: 'g' })
  state.retry('models')
  await flush()
  expect(state.getSnapshot().models).toEqual({ status: 'ready', value: [] })
  expect(api.composerCatalog.mock.calls.filter(([r]) => r.part === 'agents')).toHaveLength(1)
  remove()
  await vi.runOnlyPendingTimersAsync()
})

it('discards retired and unmounted responses without automatic reconnect', async () => {
  vi.useFakeTimers()
  let invalidate!: (value: ComposerCatalogInvalidated) => void
  api.onComposerCatalogInvalidated.mockImplementation((callback) => {
    invalidate = callback
    return vi.fn()
  })
  const gate = Promise.withResolvers<ComposerCatalogResult>()
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) =>
    r.part === 'agents' ? gate.promise : { part: 'models', value: [], generation: 'old' }
  )
  const state = new ComposerCatalogState(scope, undefined, createComposerAgentStore(vi.fn())),
    remove = state.subscribe(vi.fn())
  await flush()
  invalidate({ owner: api.composerCatalog.mock.calls[0][0].owner, generation: 'old' })
  gate.resolve({ part: 'agents', value: [{ name: 'stale' }], generation: 'old' })
  await flush()
  expect(state.getSnapshot()).toEqual({ agents: { status: 'error' }, models: { status: 'error' } })
  expect(api.composerCatalog).toHaveBeenCalledTimes(2)
  api.composerCatalog.mockResolvedValueOnce({
    part: 'agents',
    value: [{ name: 'current' }],
    generation: 'new'
  })
  state.retry('agents')
  await flush()
  invalidate({ owner: api.composerCatalog.mock.calls[0][0].owner, generation: 'old' })
  expect(state.getSnapshot().agents).toEqual({ status: 'ready', value: [{ name: 'current' }] })
  const next = Promise.withResolvers<ComposerCatalogResult>()
  api.composerCatalog.mockReturnValueOnce(next.promise)
  state.retry('agents')
  remove()
  await vi.runOnlyPendingTimersAsync()
  next.resolve({ part: 'agents', value: [{ name: 'late' }], generation: 'new' })
  await flush()
  expect(state.getSnapshot().agents.value).toEqual([{ name: 'current' }])
})

it('keeps the new generation when an older part resolves in the same epoch', async () => {
  vi.useFakeTimers()
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  const oldModels = Promise.withResolvers<ComposerCatalogResult>()
  api.composerCatalog.mockImplementation(async (request: ComposerCatalogRequest) =>
    request.part === 'models'
      ? oldModels.promise
      : { part: 'agents', value: [{ name: 'old-agent' }], generation: 'old' }
  )
  const state = new ComposerCatalogState(scope, undefined, createComposerAgentStore(vi.fn()))
  const remove = state.subscribe(vi.fn())
  await flush()
  api.composerCatalog.mockResolvedValueOnce({
    part: 'plugins',
    value: [],
    generation: 'current'
  })
  state.retry('plugins')
  await flush()
  expect(state.getSnapshot().agents.value).toEqual([{ name: 'old-agent' }])
  oldModels.resolve({
    part: 'models',
    value: [{ id: 'old/model', variants: ['stale'] }],
    generation: 'old'
  })
  await flush()
  expect(state.getSnapshot()).toEqual({
    agents: { status: 'ready', value: [{ name: 'old-agent' }] },
    models: { status: 'error' },
    plugins: { status: 'ready', value: [] }
  })
  api.composerCatalog.mockResolvedValueOnce({
    part: 'models',
    value: [{ id: 'current/model', variants: ['deep'] }],
    generation: 'current'
  })
  state.retry('models')
  await flush()
  expect(state.getSnapshot().models).toEqual({
    status: 'ready',
    value: [{ id: 'current/model', variants: ['deep'] }]
  })
  remove()
  await vi.runOnlyPendingTimersAsync()
})

it.each(['cancelled', 'error'] as const)(
  'does not turn a %s outcome into a successful empty catalog',
  async (status) => {
    vi.useFakeTimers()
    api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
    api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) => ({
      part: r.part,
      value: r.part === 'agents' ? [] : [],
      generation: 'g'
    }))
    const state = new ComposerCatalogState(scope, undefined, createComposerAgentStore(vi.fn())),
      remove = state.subscribe(vi.fn())
    await flush()
    api.composerCatalog.mockResolvedValueOnce({
      part: 'models',
      status,
      failure: { stage: 'agents', reason: 'timeout' }
    })
    state.retry('models')
    await flush()
    expect(state.getSnapshot().models).toEqual({ status: 'error', value: [] })
    remove()
    await vi.runOnlyPendingTimersAsync()
  }
)

it('publishes the first agent success to concurrent scopes and ignores later results', async () => {
  vi.useFakeTimers()
  const cache = createComposerAgentStore(vi.fn())
  const a = Promise.withResolvers<ComposerCatalogResult>(),
    b = Promise.withResolvers<ComposerCatalogResult>()
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation((request: ComposerCatalogRequest) =>
    request.part === 'agents'
      ? request.scope.cwd === 'C:/A'
        ? a.promise
        : b.promise
      : Promise.resolve({ part: 'models', value: [], generation: request.scope.cwd })
  )
  const one = new ComposerCatalogState(scope, undefined, cache)
  const two = new ComposerCatalogState(
    { ...scope, cwd: 'C:/B', providerKey: 'other' },
    undefined,
    cache
  )
  const off1 = one.subscribe(vi.fn()),
    off2 = two.subscribe(vi.fn())
  a.resolve({ part: 'agents', value: [{ name: 'first' }], generation: 'C:/A' })
  await flush()
  expect(one.getSnapshot().agents).toEqual({ status: 'ready', value: [{ name: 'first' }] })
  expect(two.getSnapshot().agents).toEqual(one.getSnapshot().agents)
  b.resolve({ part: 'agents', value: [{ name: 'late' }], generation: 'C:/B' })
  await flush()
  expect(two.getSnapshot().agents.value).toEqual([{ name: 'first' }])
  two.retry('agents')
  const third = new ComposerCatalogState({ ...scope, cwd: 'C:/C' }, undefined, cache)
  expect(third.getSnapshot().agents).toEqual(one.getSnapshot().agents)
  const off3 = third.subscribe(vi.fn())
  expect(api.composerCatalog.mock.calls.filter(([r]) => r.part === 'agents')).toHaveLength(2)
  off1()
  off2()
  off3()
  await vi.runOnlyPendingTimersAsync()
})

it('leaves the agent cache empty after failed or cancelled reads', async () => {
  vi.useFakeTimers()
  const cache = createComposerAgentStore(vi.fn())
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  let attempts = 0
  api.composerCatalog.mockImplementation(async (request: ComposerCatalogRequest) => {
    if (request.part === 'models') return { part: 'models', value: [], generation: 'g' }
    if (++attempts === 1) throw new Error('offline')
    if (attempts === 2) return { part: 'agents', status: 'cancelled' }
    return { part: 'agents', value: [], generation: 'g' }
  })
  for (const cwd of ['C:/A', 'C:/B', 'C:/C']) {
    const state = new ComposerCatalogState({ ...scope, cwd }, undefined, cache)
    const off = state.subscribe(vi.fn())
    await flush()
    expect(cache.getState().agents).toEqual(cwd === 'C:/C' ? [] : undefined)
    off()
    await vi.runOnlyPendingTimersAsync()
  }
  const last = new ComposerCatalogState({ ...scope, cwd: 'C:/D' }, undefined, cache)
  const off = last.subscribe(vi.fn())
  expect(last.getSnapshot().agents).toEqual({ status: 'ready', value: [] })
  expect(attempts).toBe(3)
  off()
  await vi.runOnlyPendingTimersAsync()
})

it('keeps cached agents through instance invalidation while models become error', async () => {
  vi.useFakeTimers()
  const cache = createComposerAgentStore(vi.fn())
  let invalidated!: (value: ComposerCatalogInvalidated) => void
  api.onComposerCatalogInvalidated.mockImplementation((callback) => {
    invalidated = callback
    return vi.fn()
  })
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) => ({
    part: r.part,
    value: r.part === 'agents' ? [{ name: 'cached' }] : [],
    generation: 'g'
  }))
  const state = new ComposerCatalogState(scope, undefined, cache),
    off = state.subscribe(vi.fn())
  await flush()
  invalidated({ owner: api.composerCatalog.mock.calls[0][0].owner, generation: 'g' })
  expect(state.getSnapshot()).toEqual({
    agents: { status: 'ready', value: [{ name: 'cached' }] },
    models: { status: 'error' }
  })
  off()
  await vi.runOnlyPendingTimersAsync()
})

it('refreshes subscribed parts once per plugin revision while keeping models', async () => {
  vi.useFakeTimers()
  let changed!: (event: { revision: number }) => void
  const cache = createComposerAgentStore((handler) => {
    changed = handler
    return vi.fn()
  })
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) => ({
    part: r.part,
    value:
      r.part === 'agents'
        ? [{ name: 'old' }]
        : r.part === 'models'
          ? [{ id: 'old/model', variants: ['old'] }]
          : [],
    generation: 'old'
  }))
  const state = new ComposerCatalogState(scope, undefined, cache),
    off = state.subscribe(vi.fn())
  await flush()
  const gate = Promise.withResolvers<ComposerCatalogResult>()
  api.composerCatalog.mockImplementation((r: ComposerCatalogRequest) =>
    r.part === 'agents'
      ? gate.promise
      : Promise.resolve({ part: r.part, value: [], generation: 'new' })
  )
  const event = { revision: 3 }
  changed(event)
  expect(state.getSnapshot().agents.status).toBe('loading')
  expect(state.getSnapshot().models.value).toEqual([{ id: 'old/model', variants: ['old'] }])
  expect(api.composerCatalog.mock.calls.slice(2).map(([r]) => [r.part, r.refresh])).toEqual([
    ['agents', true],
    ['models', true]
  ])
  changed(event)
  expect(api.composerCatalog).toHaveBeenCalledTimes(4)
  gate.resolve({ part: 'agents', value: [{ name: 'fresh' }], generation: 'new' })
  await flush()
  expect(state.getSnapshot().agents).toEqual({ status: 'ready', value: [{ name: 'fresh' }] })
  off()
  await vi.runOnlyPendingTimersAsync()
})

it.each(['error', 'cancelled', 'reject'] as const)(
  'keeps the first cached agents when a concurrent read ends as %s',
  async (outcome) => {
    vi.useFakeTimers()
    const cache = createComposerAgentStore(vi.fn()),
      late = Promise.withResolvers<ComposerCatalogResult>()
    api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
    api.composerCatalog.mockImplementation((r: ComposerCatalogRequest) =>
      r.part === 'agents' && r.scope.cwd === 'C:/B'
        ? late.promise
        : Promise.resolve({
            part: r.part,
            value: r.part === 'agents' ? [{ name: 'cached' }] : [],
            generation: r.scope.cwd
          })
    )
    const one = new ComposerCatalogState(scope, undefined, cache),
      two = new ComposerCatalogState({ ...scope, cwd: 'C:/B' }, undefined, cache)
    const off1 = one.subscribe(vi.fn()),
      off2 = two.subscribe(vi.fn())
    await flush()
    if (outcome === 'reject') late.reject(new Error('offline'))
    else if (outcome === 'cancelled') late.resolve({ part: 'agents', status: 'cancelled' })
    else
      late.resolve({
        part: 'agents',
        status: 'error',
        failure: { stage: 'agents', reason: 'network' }
      })
    await flush()
    expect(two.getSnapshot().agents).toEqual({ status: 'ready', value: [{ name: 'cached' }] })
    off1()
    off2()
    await vi.runOnlyPendingTimersAsync()
  }
)

it('refetches agents when the cache is cleared between construction and first subscribe', async () => {
  vi.useFakeTimers()
  const store = createComposerAgentStore(vi.fn())
  store.getState().accept([{ name: 'before-change' }], 0)
  const state = new ComposerCatalogState(scope, undefined, store)
  expect(state.getSnapshot().agents.value).toEqual([{ name: 'before-change' }])
  store.getState().invalidate(5)
  const reply = Promise.withResolvers<ComposerCatalogResult>()
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation((r: ComposerCatalogRequest) =>
    r.part === 'agents'
      ? reply.promise
      : Promise.resolve({ part: r.part, value: [], generation: 'new' })
  )
  const off = state.subscribe(vi.fn())
  expect(state.getSnapshot().agents).toEqual({ status: 'loading' })
  expect(api.composerCatalog.mock.calls.filter(([r]) => r.part === 'agents')).toHaveLength(1)
  reply.resolve({ part: 'agents', value: [{ name: 'after-change' }], generation: 'new' })
  await flush()
  expect(state.getSnapshot().agents.value).toEqual([{ name: 'after-change' }])
  off()
  await vi.runOnlyPendingTimersAsync()
})

it('drops agent results requested before a plugin change and caches the refetched list', async () => {
  vi.useFakeTimers()
  let changed!: (event: { revision: number }) => void
  const store = createComposerAgentStore((handler) => {
    changed = handler
    return vi.fn()
  })
  const old = Promise.withResolvers<ComposerCatalogResult>(),
    fresh = Promise.withResolvers<ComposerCatalogResult>()
  let requests = 0
  api.onComposerCatalogInvalidated.mockReturnValue(vi.fn())
  api.composerCatalog.mockImplementation((r: ComposerCatalogRequest) =>
    r.part === 'agents'
      ? ++requests === 1
        ? old.promise
        : fresh.promise
      : Promise.resolve({ part: r.part, value: [], generation: requests === 1 ? 'old' : 'new' })
  )
  const state = new ComposerCatalogState(scope, undefined, store)
  const off = state.subscribe(vi.fn())
  await flush()
  changed({ revision: 4 })
  old.resolve({ part: 'agents', value: [{ name: 'removed' }], generation: 'old' })
  await flush()
  expect(store.getState().agents).toBeUndefined()
  expect(state.getSnapshot().agents).toEqual({ status: 'loading' })
  expect(requests).toBe(2)
  fresh.resolve({ part: 'agents', value: [{ name: 'remaining' }], generation: 'new' })
  await flush()
  expect(store.getState().agents).toEqual([{ name: 'remaining' }])
  expect(state.getSnapshot().agents.value).toEqual([{ name: 'remaining' }])
  off()
  await vi.runOnlyPendingTimersAsync()
})
