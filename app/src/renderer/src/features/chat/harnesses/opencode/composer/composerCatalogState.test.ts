import { ComposerAgentCache } from './composerAgentCache'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  ComposerCatalogInvalidated,
  ComposerCatalogRequest,
  ComposerCatalogResult,
  ComposerCatalogScope
} from '../../../../../../../shared/composer-catalog'
import { ComposerCatalogState } from './composerCatalogState'
const api = vi.hoisted(() => ({
  composerCatalog: vi.fn(),
  releaseComposerCatalog: vi.fn(async () => undefined),
  onComposerCatalogInvalidated: vi.fn()
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
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  api.composerCatalog.mockReset()
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
  const state = new ComposerCatalogState(scope, undefined, new ComposerAgentCache())
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
  const state = new ComposerCatalogState(scope, undefined, new ComposerAgentCache()),
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
  const state = new ComposerCatalogState(scope, undefined, new ComposerAgentCache()),
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
  const state = new ComposerCatalogState(scope, undefined, new ComposerAgentCache())
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

it('loads resource parts only for a panel subscriber and invalidates their connection on instance loss', async () => {
  vi.useFakeTimers()
  let invalidate!: (value: ComposerCatalogInvalidated) => void
  api.onComposerCatalogInvalidated.mockImplementation((callback) => {
    invalidate = callback
    return vi.fn()
  })
  const mcp = Promise.withResolvers<ComposerCatalogResult>()
  api.composerCatalog.mockImplementation(async (r: ComposerCatalogRequest) =>
    r.part === 'mcp' ? mcp.promise : { part: r.part, value: [], generation: 'g' }
  )
  const state = new ComposerCatalogState(scope, undefined, new ComposerAgentCache())
  const composer = state.subscribe(vi.fn())
  await flush()
  expect(api.composerCatalog.mock.calls.map(([r]) => r.part)).toEqual(['agents', 'models'])
  const panel = state.subscribeResources(vi.fn())
  await flush()
  expect(state.getSnapshot().plugins).toEqual({ status: 'ready', value: [] })
  expect(state.getSnapshot().mcp?.status).toBe('loading')
  const again = state.subscribeResources(vi.fn())
  expect(api.composerCatalog).toHaveBeenCalledTimes(4)
  invalidate({ owner: api.composerCatalog.mock.calls[0][0].owner, generation: 'g' })
  mcp.resolve({
    part: 'mcp',
    value: [
      {
        id: 'late',
        name: 'late',
        kind: 'mcp',
        status: 'connected',
        enabled: true,
        canToggle: false
      }
    ],
    generation: 'g'
  })
  await flush()
  expect(state.getSnapshot().plugins).toEqual({ status: 'error' })
  expect(state.getSnapshot().mcp).toEqual({ status: 'error' })
  panel()
  again()
  composer()
  await vi.runOnlyPendingTimersAsync()
  expect(api.releaseComposerCatalog).toHaveBeenCalledOnce()
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
    const state = new ComposerCatalogState(scope, undefined, new ComposerAgentCache()),
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
  const cache = new ComposerAgentCache()
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
  const cache = new ComposerAgentCache()
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
    expect(cache.get()).toEqual(cwd === 'C:/C' ? [] : undefined)
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
  const cache = new ComposerAgentCache()
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

it('resets agents once per revision and refreshes subscribed parts while keeping models', async () => {
  vi.useFakeTimers()
  const cache = new ComposerAgentCache()
  let invalidated!: (value: ComposerCatalogInvalidated) => void
  api.onComposerCatalogInvalidated.mockImplementation((callback) => {
    invalidated = callback
    return vi.fn()
  })
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
    off = state.subscribeResources(vi.fn())
  await flush()
  const gate = Promise.withResolvers<ComposerCatalogResult>()
  api.composerCatalog.mockImplementation((r: ComposerCatalogRequest) =>
    r.part === 'agents'
      ? gate.promise
      : Promise.resolve({ part: r.part, value: [], generation: 'new' })
  )
  const event = {
    owner: api.composerCatalog.mock.calls[0][0].owner,
    generation: 'old',
    revalidate: 1
  }
  invalidated(event)
  expect(state.getSnapshot().agents.status).toBe('loading')
  expect(state.getSnapshot().models.value).toEqual([{ id: 'old/model', variants: ['old'] }])
  expect(api.composerCatalog.mock.calls.slice(4).map(([r]) => [r.part, r.refresh])).toEqual([
    ['agents', true],
    ['models', true],
    ['mcp', true],
    ['plugins', true]
  ])
  invalidated(event)
  expect(api.composerCatalog).toHaveBeenCalledTimes(8)
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
    const cache = new ComposerAgentCache(),
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
