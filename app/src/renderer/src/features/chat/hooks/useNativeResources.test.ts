import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../shared/i18n', () => {
  const tr = (key: string): string => key
  return { useI18n: () => ({ tr }) }
})
import { createElement, useLayoutEffect } from 'react'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useNativeResources } from './useNativeResources'
import { errorToastStore } from '../../../shared/errors/errorToastStore'
import type {
  DraftNativeResourcesRequest,
  NativeResource,
  NativeResources,
  NativeResourcesChanged
} from '../../../../../shared/native-resources'
import type { BackgroundEvent } from '../../../../../shared/background-task'

const resource: NativeResource = {
  id: 'native-B',
  kind: 'mcp',
  name: 'Native B',
  status: 'connected',
  enabled: true,
  canToggle: true
}
const snapshot = (generation = 'gen-B'): NativeResources => ({
  state: 'connected',
  generation,
  items: [resource]
})
let dom: FakeDom
let currentId: string | null
let current: ReturnType<typeof useNativeResources>
const read = vi.fn<(id: string) => Promise<NativeResources>>()
const observe = vi.fn<(request: unknown, observation: unknown) => void>()
let backgroundEvent: (event: BackgroundEvent) => void
const terminated = (sessionId: string, generation: string): void =>
  backgroundEvent({
    type: 'background.connection',
    sessionId,
    state: 'terminated',
    source: { generation, sequence: 1, receivedAt: 1, replay: false }
  })
function reconnectCurrent(): void {
  backgroundEvent({
    type: 'background.connection',
    sessionId: currentId!,
    state: 'connected',
    source: { generation: 'reconnected', sequence: 1, receivedAt: 1, replay: false }
  })
}
function Probe({
  id,
  open = true,
  scope = null,
  draft
}: {
  id: string | null
  open?: boolean
  scope?: string | null
  draft?: DraftNativeResourcesRequest
}): null {
  const result = useNativeResources(id, open, scope, draft)
  useLayoutEffect(() => {
    currentId = id
    current = result
  }, [id, result])
  return null
}
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  dom.act(() => {})
}
let resourcesChanged!: (event: NativeResourcesChanged) => void
beforeEach(() => {
  errorToastStore.setState({ toasts: [] })
  vi.useFakeTimers()
  read.mockReset().mockResolvedValue(snapshot())
  observe.mockClear()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  Object.assign(window, {
    orca: {
      session: {
        nativeResources: (request: string, observation?: unknown) => {
          if (observation) {
            observe(request, observation)
            return Promise.resolve({ state: 'disconnected', items: [] })
          }
          return read(request)
        },
        onNativeResourcesChanged: (callback: typeof resourcesChanged) => {
          resourcesChanged = callback
          return () => {}
        }
      },
      chat: {
        onBackgroundEvent: (callback: typeof backgroundEvent) => {
          backgroundEvent = callback
          return () => {}
        }
      }
    }
  })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('native resources session lifecycle', () => {
  it('revalidates a connected inventory on visible reopen after five seconds', async () => {
    dom.render(createElement(Probe, { id: 'freshness', scope: 'opencode' }))
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    dom.render(createElement(Probe, { id: 'freshness', scope: 'opencode', open: false }))
    await vi.advanceTimersByTimeAsync(4_999)
    dom.render(createElement(Probe, { id: 'freshness', scope: 'opencode' }))
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    dom.render(createElement(Probe, { id: 'freshness', scope: 'opencode', open: false }))
    await vi.advanceTimersByTimeAsync(1)
    read.mockResolvedValueOnce(snapshot('fresh'))
    dom.render(createElement(Probe, { id: 'freshness', scope: 'opencode' }))
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    expect(current.view).toMatchObject({ value: { generation: 'fresh' } })
  })
  it.each([
    ['backend', { backend: 'opencode' as const }],
    ['cwd', { cwd: 'C:/other' }],
    ['projectId', { projectId: 'other' }]
  ])('rejects a ready draft push differing only in %s', async (_field, difference) => {
    const draft = { backend: 'claude' as const, cwd: 'C:/scope-guard', projectId: 'expected' }
    const original = snapshot('scope-live')
    read.mockResolvedValueOnce(original)
    dom.render(createElement(Probe, { id: null, scope: 'claude', draft }))
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: original })
    const changed = {
      ...original,
      configurationPending: true,
      items: [{ ...resource, name: 'Different push', enabled: false, canToggle: false }]
    }
    resourcesChanged({ scope: { ...draft, ...difference }, resources: changed })
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: original })
    resourcesChanged({ scope: draft, resources: changed })
    await settle()
    expect(current.view).toMatchObject({ status: 'ready', value: changed })
  })

  it('owns draft observations and accepts only matching pushes while fencing an older read', async () => {
    const draft = { backend: 'claude' as const, cwd: 'C:/A', projectId: 'A' }
    let finish!: (value: NativeResources) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    dom.render(createElement(Probe, { id: null, scope: 'claude', draft }))
    await settle()
    expect(observe).toHaveBeenCalledWith(draft, expect.objectContaining({ active: true }))
    const changed = {
      ...snapshot(),
      configurationPending: true,
      items: [{ ...resource, enabled: false, canToggle: false }]
    }
    resourcesChanged({ scope: { ...draft, cwd: 'C:/B' }, resources: snapshot() })
    expect(current.view.status).toBe('loading')
    resourcesChanged({ scope: draft, resources: changed })
    await settle()
    finish(snapshot())
    await settle()
    expect(current.view).toMatchObject({ value: changed })
    dom.render(
      createElement(Probe, { id: null, scope: 'claude', draft: { ...draft, cwd: 'C:/B' } })
    )
    await settle()
    expect(observe).toHaveBeenCalledWith(draft, expect.objectContaining({ active: false }))
  })
  it('refreshes after resume and caches connected resources across partial reads and navigation until termination', async () => {
    read.mockResolvedValueOnce({ state: 'disconnected', items: [] })
    dom.render(createElement(Probe, { id: 'A', scope: 'claude' }))
    await settle()
    const live = {
      ...snapshot('resumed'),
      commands: [
        {
          name: 'design:only-after-resume',
          source: 'plugin' as const,
          description: '',
          argumentHint: ''
        }
      ]
    }
    read.mockResolvedValueOnce(live)
    backgroundEvent({
      type: 'background.connection',
      sessionId: 'A',
      state: 'connected',
      source: { generation: 'resumed', sequence: 1, receivedAt: 1, replay: false }
    })
    await settle()
    expect(current.view).toMatchObject({ value: live })
    dom.render(createElement(Probe, { id: 'B', scope: 'claude' }))
    await settle()
    read.mockResolvedValueOnce({
      state: 'connected',
      generation: 'resumed',
      items: [],
      partial: true
    })
    dom.render(createElement(Probe, { id: 'A', scope: 'claude' }))
    await settle()
    expect(current.view).toMatchObject({ value: { items: [resource], commands: live.commands } })
    expect(errorToastStore.getState().toasts).toEqual([])
    read.mockResolvedValueOnce({ state: 'disconnected', items: [] })
    terminated('A', 'resumed')
    await settle()
    expect(current.view).toMatchObject({
      value: {
        state: 'disconnected',
        items: [expect.objectContaining({ canToggle: false, status: 'configured' })]
      }
    })
  })
  it('keeps observations across remount and refresh failure, scopes by backend and replaces complete results', async () => {
    read.mockResolvedValueOnce({
      ...snapshot(),
      commands: [{ name: 'native:review', description: '', argumentHint: '', source: 'plugin' }]
    })
    dom.render(createElement(Probe, { id: 'A', scope: 'claude' }))
    await settle()
    dom.render(createElement('div'))
    let finish!: (value: NativeResources) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    dom.render(createElement(Probe, { id: 'A', scope: 'claude' }))
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    dom.act(() => reconnectCurrent())
    await settle()
    expect(current.view).toMatchObject({
      status: 'ready',
      refreshing: true,
      value: {
        items: [{ name: 'Native B', canToggle: true, status: 'connected' }],
        commands: [{ name: 'native:review' }]
      }
    })
    finish({ state: 'disconnected', items: [] })
    await settle()
    expect(current.view).toMatchObject({
      status: 'ready',
      stale: true,
      value: {
        state: 'disconnected',
        items: [{ name: 'Native B', status: 'configured', canToggle: false }],
        commands: [{ name: 'native:review' }]
      }
    })
    read.mockRejectedValueOnce(new Error('read failed'))
    dom.act(() => reconnectCurrent())
    await settle()
    expect(current.view).toMatchObject({
      status: 'ready',
      issue: 'refresh',
      value: { items: [{ name: 'Native B' }] }
    })
    read.mockResolvedValueOnce({ state: 'connected', generation: 'new', items: [] })
    dom.act(() => reconnectCurrent())
    await settle()
    expect(current.view).toEqual({
      status: 'ready',
      value: { state: 'connected', generation: 'new', items: [] }
    })
    dom.render(createElement(Probe, { id: 'A', scope: 'opencode' }))
    expect(current.view).toEqual({ status: 'loading' })
    await settle()
    expect(read).toHaveBeenCalledTimes(5)
  })
  it('reuses A after A → B → A, explicitly refreshes partial results, and fences reads on reconnect', async () => {
    dom.render(createElement(Probe, { id: 'A' }))
    await settle()
    dom.render(createElement(Probe, { id: 'B' }))
    await settle()
    read.mockResolvedValueOnce({ ...snapshot('A-new'), partial: true })
    dom.render(createElement(Probe, { id: 'A' }))
    await settle()
    expect(read.mock.calls.map(([id]) => id)).toEqual(['A', 'B'])
    dom.act(() => reconnectCurrent())
    await settle()
    expect(read.mock.calls.map(([id]) => id)).toEqual(['A', 'B', 'A'])
    expect(current.view).toEqual({
      status: 'ready',
      value: { ...snapshot('A-new'), partial: true }
    })
    expect(errorToastStore.getState().toasts).toEqual([])
    read.mockResolvedValueOnce(snapshot('A-final'))
    dom.act(() => reconnectCurrent())
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: snapshot('A-final') })
    let finish!: (value: NativeResources) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    dom.act(() => reconnectCurrent())
    await settle()
    dom.render(createElement(Probe, { id: 'A', open: false }))
    read.mockResolvedValueOnce(snapshot('A-reopened'))
    dom.render(createElement(Probe, { id: 'A', open: true }))
    backgroundEvent({
      type: 'background.connection',
      sessionId: 'A',
      state: 'connected',
      source: { generation: 'A-reopened', sequence: 2, receivedAt: 2, replay: false }
    })
    await settle()
    finish(snapshot('stale'))
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: snapshot('A-reopened') })
  })
  it.each(['read'] as const)(
    'keeps a late %s scoped to its session after navigation',
    async (operation) => {
      let finish!: (result: NativeResources) => void
      if (operation === 'read')
        read.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve
            })
        )
      dom.render(createElement(Probe, { id: 'session-A' }))
      await settle()
      read.mockResolvedValueOnce(snapshot('gen-C'))
      dom.render(createElement(Probe, { id: 'session-C' }))
      expect(current.view.status).toBe('loading')
      await settle()
      finish(snapshot('stale'))
      await settle()
      expect(current.view).toEqual({ status: 'ready', value: snapshot('gen-C') })
    }
  )
  it('distinguishes disconnected from failure and retries on reopening', async () => {
    dom.render(createElement(Probe, { id: null }))
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: { state: 'disconnected', items: [] } })
    expect(read).not.toHaveBeenCalled()
    read.mockRejectedValueOnce(new Error('offline'))
    dom.render(createElement(Probe, { id: 'session-B' }))
    await settle()
    expect(current.view).toEqual({ status: 'error' })
    dom.render(createElement(Probe, { id: 'session-B', open: false }))
    dom.render(createElement(Probe, { id: 'session-B', open: true }))
    await settle()
    expect(current.view.status).toBe('ready')
    expect(read).toHaveBeenCalledTimes(2)
  })
})

it('discovers draft skills by cwd and ignores a late result from another draft folder', async () => {
  let resolveA!: (value: NativeResources) => void
  read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveA = resolve
      })
  )
  const draft = { backend: 'claude' as const, cwd: 'C:/draft-A', projectId: 'project-A' }
  dom.render(createElement(Probe, { id: null, scope: 'claude', draft }))
  await settle()
  expect(read).toHaveBeenCalledWith(draft)
  const b = {
    state: 'disconnected' as const,
    items: [],
    commands: [{ name: 'B:design', description: '', argumentHint: '', source: 'plugin' as const }]
  }
  read.mockResolvedValue(b)
  dom.render(
    createElement(Probe, { id: null, scope: 'claude', draft: { ...draft, cwd: 'C:/draft-B' } })
  )
  await settle()
  resolveA({ ...b, commands: [{ ...b.commands[0], name: 'A:old' }] })
  await settle()
  expect(current.view).toMatchObject({ status: 'ready', value: b })
})

it('reports load errors once, discards late failures and removes stale installed plugins offline', async () => {
  read.mockRejectedValueOnce(new Error('load rejected'))
  dom.render(createElement(Probe, { id: 'A', scope: 'claude' }))
  await settle()
  expect(errorToastStore.getState().toasts).toMatchObject([
    { title: 'loadFailed', detail: 'load rejected' }
  ])
  errorToastStore.setState({ toasts: [] })
  let rejectLate!: (error: Error) => void
  read.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectLate = reject
      })
  )
  dom.act(() => reconnectCurrent())
  await settle()
  const plugin = { ...resource, kind: 'plugin' as const, canToggle: false }
  read.mockResolvedValueOnce({ state: 'disconnected', items: [plugin], pluginsAuthoritative: true })
  dom.render(createElement(Probe, { id: 'B', scope: 'claude' }))
  await settle()
  rejectLate(new Error('previous session'))
  await settle()
  expect(errorToastStore.getState().toasts).toHaveLength(0)
  read.mockResolvedValueOnce({ state: 'disconnected', items: [], pluginsAuthoritative: true })
  dom.act(() => reconnectCurrent())
  await settle()
  expect(current.view).toMatchObject({ value: { items: [] } })
})

describe('process-owned state and independent async controls', () => {
  it('rejects an exited generation even when its initial read has not arrived', async () => {
    let finish!: (value: NativeResources) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    dom.render(createElement(Probe, { id: 'A' }))
    await settle()
    read.mockResolvedValueOnce(snapshot('A-next'))
    dom.act(() => terminated('A', 'gen-B'))
    await settle()
    finish(snapshot())
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: snapshot('A-next') })
  })
})

it('updates a peer popup cache from actual shared changes and fences older reads and exited generations', async () => {
  dom.render(createElement(Probe, { id: 'session-A' }))
  await settle()
  dom.render(createElement(Probe, { id: 'session-B' }))
  await settle()
  let finishRead!: (value: NativeResources) => void
  read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = resolve
      })
  )
  reconnectCurrent()
  const disabled = {
    ...snapshot(),
    items: [{ ...resource, enabled: false, status: 'disabled' as const }]
  }
  resourcesChanged({ sessionId: 'session-B', resources: disabled })
  finishRead(snapshot())
  await settle()
  expect(current.view).toMatchObject({ value: { items: [{ enabled: false }] } })
  resourcesChanged({ sessionId: 'session-A', resources: disabled })
  read.mockImplementationOnce(() => new Promise(() => {}))
  dom.render(createElement(Probe, { id: 'session-A' }))
  await settle()
  expect(current.view).toMatchObject({ value: { items: [{ enabled: false }] } })
  terminated('session-A', 'gen-B')
  await settle()
  resourcesChanged({ sessionId: 'session-A', resources: snapshot() })
  expect(current.view).toMatchObject({
    value: { state: 'disconnected', items: [{ canToggle: false }] }
  })
})
