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
  const state = new ComposerCatalogState(scope)
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
    value: r.part === 'agents' ? [{ name: 'Atlas' }] : [],
    generation: 'g'
  }))
  const state = new ComposerCatalogState(scope),
    remove = state.subscribe(vi.fn())
  await flush()
  const gate = Promise.withResolvers<ComposerCatalogResult>()
  api.composerCatalog.mockReturnValueOnce(gate.promise)
  state.retry('agents')
  state.retry('agents')
  expect(api.composerCatalog).toHaveBeenCalledTimes(3)
  gate.reject(new Error('offline'))
  await flush()
  expect(state.getSnapshot().agents).toEqual({ status: 'error', value: [{ name: 'Atlas' }] })
  api.composerCatalog.mockResolvedValueOnce({ part: 'agents', value: [], generation: 'g' })
  state.retry('agents')
  await flush()
  expect(state.getSnapshot().agents).toEqual({ status: 'ready', value: [] })
  expect(api.composerCatalog.mock.calls.filter(([r]) => r.part === 'models')).toHaveLength(1)
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
  const state = new ComposerCatalogState(scope),
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
  const state = new ComposerCatalogState(scope)
  const remove = state.subscribe(vi.fn())
  await flush()
  api.composerCatalog.mockResolvedValueOnce({
    part: 'agents',
    value: [{ name: 'current-agent' }],
    generation: 'current'
  })
  state.retry('agents')
  await flush()
  expect(state.getSnapshot().agents.value).toEqual([{ name: 'current-agent' }])
  oldModels.resolve({
    part: 'models',
    value: [{ id: 'old/model', variants: ['stale'] }],
    generation: 'old'
  })
  await flush()
  expect(state.getSnapshot()).toEqual({
    agents: { status: 'ready', value: [{ name: 'current-agent' }] },
    models: { status: 'error' }
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
  const state = new ComposerCatalogState(scope)
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
      value: r.part === 'agents' ? [{ name: 'Atlas' }] : [],
      generation: 'g'
    }))
    const state = new ComposerCatalogState(scope),
      remove = state.subscribe(vi.fn())
    await flush()
    api.composerCatalog.mockResolvedValueOnce({
      part: 'agents',
      status,
      failure: { stage: 'agents', reason: 'timeout' }
    })
    state.retry('agents')
    await flush()
    expect(state.getSnapshot().agents).toEqual({ status: 'error', value: [{ name: 'Atlas' }] })
    remove()
    await vi.runOnlyPendingTimersAsync()
  }
)
