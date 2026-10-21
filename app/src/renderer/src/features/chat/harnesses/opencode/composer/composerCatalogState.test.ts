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
