import { describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../../shared/ipc'

vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  return { create: createStore }
})
vi.mock('../api/ipc', () => ({
  agentApi: { list: vi.fn() },
  providerApi: { onState: vi.fn() },
  harnessApi: { onAvailability: vi.fn() }
}))
vi.mock('../errors', () => ({ reportError: vi.fn() }))

const { createAgentStore } = await import('./agentStore')

it('wires the production agent store to the harness API and refreshes changed availability once', async () => {
  const { agentApi, harnessApi } = await import('../api/ipc')
  const { useAgentStore } = await import('./agentStore')
  let push!: () => void
  const stop = vi.fn()
  vi.mocked(agentApi.list).mockResolvedValue([env('initial')])
  vi.mocked(harnessApi.onAvailability).mockImplementation((listener) => {
    push = () =>
      listener({ id: 'opencode', installed: false, usable: false, unavailableReason: 'failed' })
    return stop
  })
  await useAgentStore.getState().ensureLoaded()
  expect(harnessApi.onAvailability).toHaveBeenCalledOnce()
  vi.mocked(agentApi.list)
    .mockClear()
    .mockResolvedValue([env('after-change')])
  push()
  await vi.waitFor(() => expect(useAgentStore.getState().agents[0]?.key).toBe('after-change'))
  expect(agentApi.list).toHaveBeenCalledOnce()
  useAgentStore.getState().dispose()
  expect(stop).toHaveBeenCalledOnce()
})

function env(key: string): AgentEnvironment {
  return { key, adapter: 'opencode', models: [], supported: true }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('agentStore (0291 D-021)', () => {
  it('refreshes on provider pushes after the first read even with no mounted consumer', async () => {
    let push: (() => void) | undefined
    const list = vi.fn(async () => [env('a')])
    const store = createAgentStore({ list, subscribe: (handler) => (push = handler) })
    expect(push).toBeUndefined()
    await store.getState().ensureLoaded()
    expect(list).toHaveBeenCalledTimes(1)
    list.mockResolvedValueOnce([env('a'), env('b')])
    push!()
    await vi.waitFor(() => expect(store.getState().agents.map((a) => a.key)).toEqual(['a', 'b']))
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('ignores an older agent:list response that resolves after a newer one', async () => {
    const first = deferred<AgentEnvironment[]>()
    const second = deferred<AgentEnvironment[]>()
    const list = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const store = createAgentStore({ list, subscribe: () => undefined })
    const older = store.getState().refresh()
    const newer = store.getState().refresh()
    second.resolve([env('new')])
    await newer
    first.resolve([env('old')])
    await older
    expect(store.getState().agents.map((a) => a.key)).toEqual(['new'])
    expect(store.getState().loading).toBe(false)
  })

  it('installs the provider subscription once and never removes it', async () => {
    const unsubscribe = vi.fn()
    const subscribe = vi.fn(() => unsubscribe)
    const store = createAgentStore({ list: async () => [], subscribe })
    await store.getState().ensureLoaded()
    await store.getState().refresh()
    await store.getState().ensureLoaded()
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(unsubscribe).not.toHaveBeenCalled()
  })
})

it('refreshes once per availability event and unsubscribes on disposal', async () => {
  const list = vi.fn(async () => []),
    stop = vi.fn()
  let push!: () => void
  const store = createAgentStore({
    list,
    subscribe: () => undefined,
    subscribeAvailability: (handler) => {
      push = handler
      return stop
    }
  })
  await store.getState().ensureLoaded()
  list.mockClear()
  push()
  await Promise.resolve()
  expect(list).toHaveBeenCalledOnce()
  store.getState().dispose()
  expect(stop).toHaveBeenCalledOnce()
  push()
  expect(list).toHaveBeenCalledOnce()
})
