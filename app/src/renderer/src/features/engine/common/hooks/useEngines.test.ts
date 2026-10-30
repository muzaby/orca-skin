import { createElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StateCreator, StoreApi } from 'zustand/vanilla'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { useAgentStore } from '../../../../shared/stores/agentStore'
import { useEngines } from './useEngines'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  onState: vi.fn(),
  unsubscribe: vi.fn(),
  // store 는 모듈 수명 동안 구독을 한 번만 설치한다 — clearAllMocks 로 지워지지 않게 따로 둔다.
  push: null as (() => void) | null
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  return {
    // Substitute only the React binding. The real agentStore initializer and cache still run.
    create: <T>(initializer: StateCreator<T>) => {
      const store: StoreApi<T> = createStore(initializer)
      return Object.assign((select: (state: T) => unknown) => select(store.getState()), store)
    }
  }
})
vi.mock('../../../../shared/api/ipc', () => ({
  engineApi: { add: api.add, update: api.update, delete: api.remove, read: vi.fn() },
  agentApi: { list: api.list },
  providerApi: { onState: api.onState }
}))
vi.mock('../../../../shared/errors', () => ({ reportError: vi.fn() }))

let dom: FakeDom
let current: ReturnType<typeof useEngines>
function Probe(): null {
  const value = useEngines()
  useEffect(() => {
    current = value
  }, [value])
  return null
}
function render(): void {
  dom.render(createElement(Probe))
}
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockReset().mockResolvedValue([])
  api.add.mockReset().mockResolvedValue(undefined)
  api.update.mockReset().mockResolvedValue(undefined)
  api.remove.mockReset().mockResolvedValue(undefined)
  api.onState.mockImplementation((handler: () => void) => {
    api.push = handler
    return api.unsubscribe
  })
  useAgentStore.setState({ agents: [], loaded: false, loading: false, error: null })
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
})

describe('engine catalog and mutation lifetimes (0262 AC31)', () => {
  it('loads a cold catalog once and reuses it on subsequent entry refreshes', async () => {
    render()
    await current.refresh()
    expect(api.list).toHaveBeenCalledTimes(1)
    await current.refresh()
    expect(api.list).toHaveBeenCalledTimes(1)
    dom.unmount()
    render()
    await current.refresh()
    expect(api.list).toHaveBeenCalledTimes(1)
    // 화면이 내려가도 provider 구독은 store 수명이다(0291 D-021).
    expect(api.unsubscribe).not.toHaveBeenCalled()
  })

  it('shows a runtime card added while the engine page was unmounted', async () => {
    render()
    await current.refresh()
    dom.unmount()
    // 플러그인 탭에서 인증·연결 → provider push. 엔진 화면은 마운트되어 있지 않다.
    const runtime = {
      key: 'opencode-corp',
      adapter: 'opencode',
      provider: 'corp',
      models: [],
      supported: true,
      source: 'runtime' as const,
      readOnly: true
    }
    api.list.mockResolvedValueOnce([runtime])
    expect(api.push).not.toBeNull()
    api.push!()
    await vi.waitFor(() => expect(useAgentStore.getState().agents).toEqual([runtime]))
    render()
    await current.refresh()
    expect(current.agents).toEqual([runtime])
  })

  it('does not force another query or lock mutations during an external catalog load', async () => {
    useAgentStore.setState({ loading: true })
    render()
    expect(current.state.busy).toBe(false)
    await current.refresh()
    expect(api.list).not.toHaveBeenCalled()
  })

  it.each(['add', 'update', 'remove'] as const)(
    '%s keeps mutation busy until its write and catalog refresh finish',
    async (operation) => {
      const write = deferred()
      const refresh = deferred()
      api[operation].mockReturnValueOnce(write.promise)
      api.list.mockImplementationOnce(async () => {
        await refresh.promise
        return []
      })
      useAgentStore.setState({ loaded: true })
      render()
      const pending =
        operation === 'add'
          ? current.add({ engine: 'claude', provider: 'fixture', settingsJson: '{}' })
          : operation === 'update'
            ? current.update({ key: 'claude/fixture', settingsJson: '{}' })
            : current.remove('claude/fixture')
      render()
      expect(current.state.busy).toBe(true)
      expect(api.list).not.toHaveBeenCalled()
      write.resolve()
      await Promise.resolve()
      expect(api.list).toHaveBeenCalledTimes(1)
      render()
      expect(current.state.busy).toBe(true)
      refresh.resolve()
      await pending
      render()
      expect(current.state).toEqual({ busy: false, error: null })
    }
  )

  it('retains catalog errors and reports mutation errors without refreshing after a failed write', async () => {
    useAgentStore.setState({ loaded: true, error: { raw: 'catalog unavailable' } })
    render()
    expect(current.state).toEqual({ busy: false, error: { raw: 'catalog unavailable' } })
    api.update.mockRejectedValueOnce(new Error('write failed'))
    await expect(current.update({ key: 'claude/fixture', settingsJson: '{}' })).rejects.toThrow(
      'write failed'
    )
    render()
    expect(current.state).toEqual({ busy: false, error: { raw: 'write failed' } })
    expect(api.list).not.toHaveBeenCalled()
  })
})
