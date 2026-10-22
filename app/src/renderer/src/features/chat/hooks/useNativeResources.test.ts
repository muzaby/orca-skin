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
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'
const panelSession = vi.hoisted(() => ({
  sessionId: null as string | null,
  backend: 'claude' as 'claude' | 'opencode',
  cwd: null as string | null,
  projectId: null as string | null,
  pendingProjectId: null,
  onClose: undefined as (() => void) | undefined
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (state: typeof panelSession) => unknown) => select(panelSession),
  chatActions: { removeRightPanelTile: () => panelSession.onClose?.() }
}))
import {
  NativeResourcesTileContent,
  NativeResourcesTileHeader
} from '../components/rightpanel/NativeResourcesTile'
function NativeResourcesPanel(props: {
  sessionId: string | null
  backend: 'claude' | 'opencode'
  cwd?: string | null
  projectId?: string | null
  anchorRef?: unknown
  onClose?: () => void
}): React.JSX.Element {
  Object.assign(panelSession, { cwd: null, projectId: null }, props)
  return createElement(
    'div',
    null,
    createElement(NativeResourcesTileHeader),
    createElement(NativeResourcesTileContent)
  )
}
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
let current: ReturnType<typeof useNativeResources>
const read = vi.fn<(id: string) => Promise<NativeResources>>()
const write = vi.fn<(req: unknown) => Promise<NativeResources>>()
const openFolder = vi.fn<(req: unknown) => Promise<void>>()
const observe = vi.fn<(request: unknown, observation: unknown) => void>()
let backgroundEvent: (event: BackgroundEvent) => void
const terminated = (sessionId: string, generation: string): void =>
  backgroundEvent({
    type: 'background.connection',
    sessionId,
    state: 'terminated',
    source: { generation, sequence: 1, receivedAt: 1, replay: false }
  })
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
    current = result
  }, [result])
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
  openFolder.mockReset().mockResolvedValue(undefined)
  write.mockReset().mockResolvedValue({
    ...snapshot(),
    items: [{ ...resource, enabled: false, status: 'disabled' }]
  })
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
        setNativeResource: write,
        openNativePlugin: openFolder,
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
  it('reveals an MCP configuration from the name while the separate switch controls its state', async () => {
    dom.render(
      createElement(NativeResourcesPanel, {
        sessionId: 'session-B',
        backend: 'claude',
        anchorRef: { current: null },
        onClose: () => {}
      })
    )
    await settle()
    dom.click(dom.query('[role="menuitem"]')!)
    await settle()
    expect(openFolder).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'session-B',
      id: 'native-B',
      kind: 'mcp'
    })
    expect(write).not.toHaveBeenCalled()
    dom.click(dom.query('[role="menuitemcheckbox"]')!)
    await settle()
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ kind: 'mcp', enabled: false }))
    expect(openFolder).toHaveBeenCalledTimes(1)
  })
  it('opens a plugin directory from the normal menu row and reloads after failure without toggling', async () => {
    const plugin = {
      ...resource,
      kind: 'plugin' as const,
      description: 'Workflow skills',
      canToggle: false
    }
    read.mockResolvedValue({ ...snapshot(), items: [plugin] })
    dom.render(
      createElement(NativeResourcesPanel, {
        sessionId: 'B',
        backend: 'claude',
        anchorRef: { current: null },
        onClose: () => {}
      })
    )
    await settle()
    const row = dom.query('[role="menuitem"]')!
    expect(row.props.disabled).toBeFalsy()
    expect(row.props['aria-checked']).toBeUndefined()
    expect(row.props.title).toBe('Workflow skills\nchat.nativeResources.openFolder')
    dom.click(row)
    await settle()
    expect(openFolder).toHaveBeenCalledExactlyOnceWith({ sessionId: 'B', id: 'native-B' })
    expect(write).not.toHaveBeenCalled()
    openFolder.mockRejectedValueOnce(new Error('folder missing'))
    dom.click(row)
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    expect(dom.query('[role="status"]')).toBeNull()
    expect(errorToastStore.getState().toasts).toMatchObject([
      { title: 'openFailed', detail: 'folder missing' }
    ])
    dom.click(dom.query('[role="menuitem"]')!)
    await settle()
    expect(dom.query('[role="status"]')).toBeNull()
    expect(openFolder).toHaveBeenCalledTimes(3)
    expect(
      dom
        .queryAll('[type="button"]')
        .some((item) => item.textContent === 'chat.nativeResources.refresh')
    ).toBe(false)
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
    dom.act(() => current.refresh())
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
    dom.act(() => current.refresh())
    await settle()
    expect(current.view).toMatchObject({
      status: 'ready',
      issue: 'refresh',
      value: { items: [{ name: 'Native B' }] }
    })
    read.mockResolvedValueOnce({ state: 'connected', generation: 'new', items: [] })
    dom.act(() => current.refresh())
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
  it.each([false, true])(
    'reloads after failed control, preserving the list if reload also fails (%s)',
    async (readFails) => {
      dom.render(createElement(Probe, { id: 'A' }))
      await settle()
      write.mockRejectedValueOnce(new Error('write failed'))
      if (readFails) read.mockRejectedValueOnce(new Error('read failed'))
      else
        read.mockResolvedValueOnce({
          ...snapshot('updated'),
          items: [{ ...resource, enabled: false, status: 'disabled' }]
        })
      await current.toggle(resource)
      await settle()
      expect(read).toHaveBeenCalledTimes(2)
      expect(current.view).toMatchObject({
        status: 'ready',
        issue: 'control',
        value: { items: [{ id: resource.id, enabled: readFails, canToggle: true }] }
      })
      expect(current.busy).toBe(false)
      if (readFails) {
        await current.toggle(resource)
        expect(write).toHaveBeenCalledTimes(2)
      }
    }
  )
  it('reuses A after A → B → A, explicitly refreshes partial results, and fences reads on reconnect', async () => {
    dom.render(createElement(Probe, { id: 'A' }))
    await settle()
    dom.render(createElement(Probe, { id: 'B' }))
    await settle()
    read.mockResolvedValueOnce({ ...snapshot('A-new'), partial: true })
    dom.render(createElement(Probe, { id: 'A' }))
    await settle()
    expect(read.mock.calls.map(([id]) => id)).toEqual(['A', 'B'])
    dom.act(() => current.refresh())
    await settle()
    expect(read.mock.calls.map(([id]) => id)).toEqual(['A', 'B', 'A'])
    expect(current.view).toEqual({
      status: 'ready',
      value: { ...snapshot('A-new'), partial: true }
    })
    expect(errorToastStore.getState().toasts).toEqual([])
    read.mockResolvedValueOnce(snapshot('A-final'))
    dom.act(() => current.refresh())
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: snapshot('A-final') })
    let finish!: (value: NativeResources) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    dom.act(() => current.refresh())
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
  it('carries session/generation/resource fields and serializes toggles, without optimistic success', async () => {
    dom.render(createElement(Probe, { id: 'session-B' }))
    await settle()
    expect(read).toHaveBeenCalledExactlyOnceWith('session-B')
    expect(current.view).toEqual({ status: 'ready', value: snapshot() })
    let finish!: (result: NativeResources) => void
    write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = current.toggle(resource)
    await current.toggle(resource)
    dom.act(() => {})
    expect(current.busy).toBe(true)
    expect(write).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'session-B',
      generation: 'gen-B',
      kind: 'mcp',
      id: 'native-B',
      enabled: false
    })
    expect(current.view).toEqual({ status: 'ready', value: snapshot() })
    finish({ ...snapshot(), items: [{ ...resource, enabled: false, status: 'disabled' }] })
    await pending
    await settle()
    await current.toggle({ ...resource, enabled: false })
    expect(write).toHaveBeenLastCalledWith({
      sessionId: 'session-B',
      generation: 'gen-B',
      kind: 'mcp',
      id: 'native-B',
      enabled: true
    })
    await current.toggle({ ...resource, kind: 'plugin', canToggle: false })
    expect(write).toHaveBeenCalledTimes(2)
  })
  it.each(['read', 'write'] as const)(
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
      let pending: Promise<void> | undefined
      if (operation === 'write') {
        write.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve
            })
        )
        pending = current.toggle(resource)
      }
      read.mockResolvedValueOnce(snapshot('gen-C'))
      dom.render(createElement(Probe, { id: 'session-C' }))
      expect(current.view.status).toBe('loading')
      await settle()
      finish(snapshot('stale'))
      await pending
      await settle()
      expect(current.view).toEqual({ status: 'ready', value: snapshot('gen-C') })
    }
  )
  it('distinguishes disconnected from failure and retries on reopening; closing discards pending state', async () => {
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
    write.mockRejectedValueOnce(new Error('denied'))
    await current.toggle(resource)
    await settle()
    expect(current.view).toMatchObject({ status: 'ready', issue: 'control', value: snapshot() })
    expect(read).toHaveBeenCalledTimes(3)
  })
})

it('renders the live session panel and keeps it open while the MCP toggle refreshes', async () => {
  const onClose = vi.fn()
  dom.render(
    createElement(NativeResourcesPanel, {
      sessionId: 'session-B',
      backend: 'opencode',
      anchorRef: { current: null },
      onClose
    })
  )
  await settle()
  expect(read).toHaveBeenCalledExactlyOnceWith('session-B')
  expect(dom.query('[data-native-status-title]')?.textContent).toContain('OpenCode')
  const item = dom.query('[role="menuitemcheckbox"]')!
  expect(item.props['aria-checked']).toBe(true)
  dom.click(item)
  await settle()
  expect(write).toHaveBeenCalledExactlyOnceWith({
    sessionId: 'session-B',
    generation: 'gen-B',
    kind: 'mcp',
    id: 'native-B',
    enabled: false
  })
  expect(dom.query('[role="menuitemcheckbox"]')?.props['aria-checked']).toBe(false)
  expect(onClose).not.toHaveBeenCalled()
  write.mockRejectedValueOnce(new Error('write rejected'))
  read.mockRejectedValueOnce(new Error('refresh rejected'))
  dom.click(dom.query('[role="menuitemcheckbox"]')!)
  await settle()
  expect(dom.query('[role="status"]')).toBeNull()
  expect(errorToastStore.getState().toasts).toMatchObject([
    { title: 'actionFailed', detail: 'write rejected' }
  ])
  expect(dom.query('[role="menuitem"]')?.textContent).toContain('Native B')
  expect(
    dom
      .queryAll('[type="button"]')
      .some((item) => item.textContent === 'chat.nativeResources.refresh')
  ).toBe(false)
  dom.render(createElement('div'))
  dom.render(
    createElement(NativeResourcesPanel, {
      sessionId: 'session-B',
      backend: 'opencode',
      anchorRef: { current: null },
      onClose
    })
  )
  await settle()
  expect(read).toHaveBeenCalledTimes(3)
  expect(dom.query('[role="status"]')).toBeNull()
  dom.query('[role="menu"]')!.focus()
  dom.keyDown('Escape')
  expect(onClose).toHaveBeenCalledOnce()
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
  await current.toggle(resource)
  expect(write).not.toHaveBeenCalled()
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
  dom.act(() => current.refresh())
  await settle()
  const plugin = { ...resource, kind: 'plugin' as const, canToggle: false }
  read.mockResolvedValueOnce({ state: 'disconnected', items: [plugin], pluginsAuthoritative: true })
  dom.render(createElement(Probe, { id: 'B', scope: 'claude' }))
  await settle()
  rejectLate(new Error('previous session'))
  await settle()
  expect(errorToastStore.getState().toasts).toHaveLength(0)
  read.mockResolvedValueOnce({ state: 'disconnected', items: [], pluginsAuthoritative: true })
  dom.act(() => current.refresh())
  await settle()
  expect(current.view).toMatchObject({ value: { items: [] } })
})

it('separates plugin folder clicks from session controls, including keyboard and failure toast', async () => {
  const plugin = {
    ...resource,
    kind: 'plugin' as const,
    name: 'Workflow',
    enabled: false,
    status: 'disabled' as const
  }
  read.mockResolvedValue({ ...snapshot(), items: [plugin] })
  write.mockResolvedValue({
    ...snapshot(),
    items: [{ ...plugin, enabled: true, status: 'enabled' }]
  })
  dom.render(
    createElement(NativeResourcesPanel, {
      sessionId: 'B',
      backend: 'claude',
      anchorRef: { current: null },
      onClose: () => {}
    })
  )
  await settle()
  const folder = (): FakeNode => dom.query('[role="menuitem"]')!
  const control = (): FakeNode => dom.query('[role="menuitemcheckbox"]')!
  dom.click(folder())
  await settle()
  expect(openFolder).toHaveBeenCalledExactlyOnceWith({ sessionId: 'B', id: 'native-B' })
  dom.click(control())
  await settle()
  expect(write).toHaveBeenCalledExactlyOnceWith({
    sessionId: 'B',
    generation: 'gen-B',
    kind: 'plugin',
    id: 'native-B',
    enabled: true
  })
  expect(control().props['aria-checked']).toBe(true)
  write.mockRejectedValueOnce(new Error('runtime denied'))
  read.mockRejectedValueOnce(new Error('reload denied'))
  dom.act(() =>
    (control().props.onKeyDown as (event: unknown) => void)({
      key: 'Enter',
      stopPropagation: vi.fn(),
      preventDefault: vi.fn()
    })
  )
  await settle()
  expect(errorToastStore.getState().toasts).toMatchObject([
    { title: 'actionFailed', detail: 'runtime denied' }
  ])
  expect(errorToastStore.getState().toasts).toHaveLength(1)
  expect(openFolder).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledTimes(2)
  expect(dom.query('[role="status"]')).toBeNull()
})

it('opens an installed plugin in a draft by its current scope and reloads on failure', async () => {
  const plugin = { ...resource, kind: 'plugin' as const, canToggle: false }
  read.mockResolvedValue({ state: 'disconnected', items: [plugin], pluginsAuthoritative: true })
  const draft = { backend: 'claude' as const, cwd: 'C:/draft', projectId: 'draft-project' }
  dom.render(createElement(Probe, { id: null, scope: 'claude', draft }))
  await settle()
  await current.openPlugin(plugin)
  expect(openFolder).toHaveBeenCalledExactlyOnceWith({ ...draft, id: plugin.id })
  openFolder.mockRejectedValueOnce(new Error('draft folder missing'))
  await current.openPlugin(plugin)
  await settle()
  expect(read).toHaveBeenCalledTimes(2)
  expect(read).toHaveBeenLastCalledWith(draft)
  expect(errorToastStore.getState().toasts).toMatchObject([
    { title: 'openFailed', detail: 'draft folder missing' }
  ])
  await current.toggle({ ...plugin, canToggle: true })
  expect(write).not.toHaveBeenCalled()
})

describe('process-owned state and independent async controls', () => {
  it.each([false, true])(
    'retains pending work and its result across A → B → A (finish away=%s)',
    async (finishAway) => {
      dom.render(createElement(Probe, { id: 'A' }))
      await settle()
      let finish!: (value: NativeResources) => void
      write.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      const pending = current.toggle(resource)
      dom.act(() => {})
      expect([...current.pending]).toEqual(['mcp:native-B'])
      read.mockResolvedValueOnce(snapshot('B-live'))
      dom.render(createElement(Probe, { id: 'B' }))
      await settle()
      const disabled: NativeResources = {
        ...snapshot(),
        items: [{ ...resource, enabled: false, status: 'disabled' }]
      }
      if (finishAway) {
        finish(disabled)
        await pending
      }
      dom.render(createElement(Probe, { id: 'A' }))
      await settle()
      expect(current.view).toMatchObject({
        status: 'ready',
        value: { generation: 'gen-B', items: [{ canToggle: true, enabled: !finishAway }] }
      })
      expect(current.pending.size).toBe(finishAway ? 0 : 1)
      if (!finishAway) {
        finish(disabled)
        await pending
        await settle()
      }
      expect(current.view).toMatchObject({ status: 'ready', value: disabled })
      expect(current.pending.size).toBe(0)
      expect(read).toHaveBeenCalledTimes(2)
    }
  )

  it('shares observations and operations between Composer and menu consumers', async () => {
    const consumers: ReturnType<typeof useNativeResources>[] = []
    function Consumers(): null {
      const composer = useNativeResources('A', true, 'claude')
      const menu = useNativeResources('A', true, 'claude')
      useLayoutEffect(() => {
        consumers[0] = composer
        consumers[1] = menu
      }, [composer, menu])
      return null
    }
    dom.render(createElement(Consumers))
    await settle()
    expect(consumers[0].view).toBe(consumers[1].view)
    let finish!: (value: NativeResources) => void
    write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = consumers[0].toggle(resource)
    dom.act(() => {})
    expect(consumers.map((value) => [...value.pending])).toEqual([
      ['mcp:native-B'],
      ['mcp:native-B']
    ])
    await consumers[1].toggle(resource)
    expect(write).toHaveBeenCalledOnce()
    finish({ ...snapshot(), items: [{ ...resource, enabled: false, status: 'disabled' }] })
    await pending
    await settle()
    expect(consumers[0].view).toBe(consumers[1].view)
    expect(consumers[1].view).toMatchObject({ value: { items: [{ enabled: false }] } })
  })

  it('starts different item controls independently and blocks only a duplicate of the pending item', async () => {
    const plugin: NativeResource = { ...resource, kind: 'plugin', status: 'enabled' }
    read.mockResolvedValue({ ...snapshot(), items: [resource, plugin] })
    dom.render(
      createElement(NativeResourcesPanel, {
        sessionId: 'A',
        backend: 'claude',
        anchorRef: { current: null },
        onClose: () => {}
      })
    )
    await settle()
    const finishes: ((value: NativeResources) => void)[] = []
    write.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishes.push(resolve)
        })
    )
    const ball = dom.query('[role="menuitemcheckbox"]')!
    dom.click(ball)
    await settle()
    expect(dom.query('[data-toggle-spinner]')).not.toBeNull()
    expect(dom.query('[role="menuitemcheckbox"]')?.props.disabled).toBe(true)
    dom.click(ball)
    expect(dom.queryAll('[role="menuitemcheckbox"]')[1]?.props.disabled).toBe(false)
    dom.click(dom.queryAll('[role="menuitemcheckbox"]')[1]!)
    await settle()
    expect(write.mock.calls.map(([req]) => (req as { kind: string }).kind)).toEqual([
      'mcp',
      'plugin'
    ])
    expect(dom.query('[role="menuitem"]')?.props.disabled).toBeFalsy()
    expect(dom.query('[role="menuitem"]')?.props.disabled).toBeFalsy()
    finishes[0]({
      ...snapshot(),
      items: [{ ...resource, enabled: false, status: 'disabled' }, plugin]
    })
    await settle()
    expect(dom.query('[data-toggle-spinner]')).not.toBeNull()
    finishes[1]({
      ...snapshot(),
      items: [resource, { ...plugin, enabled: false, status: 'disabled' }]
    })
    await settle()
    expect(dom.query('[data-toggle-spinner]')).toBeNull()
    expect(dom.queryAll('[role="menuitemcheckbox"]')[1]?.props['aria-checked']).toBe(false)
  })

  it('retires an inactive process generation and rejects its late write without affecting the next process', async () => {
    dom.render(createElement(Probe, { id: 'A' }))
    await settle()
    let finish!: (value: NativeResources) => void
    write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = current.toggle(resource)
    read.mockResolvedValueOnce(snapshot('B-live'))
    dom.render(createElement(Probe, { id: 'B' }))
    await settle()
    dom.act(() => terminated('A', 'gen-B'))
    finish({ ...snapshot(), items: [{ ...resource, enabled: false, status: 'disabled' }] })
    await pending
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: snapshot('B-live') })
    let finishRead!: (value: NativeResources) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve
        })
    )
    dom.render(createElement(Probe, { id: 'A' }))
    await settle()
    expect(current.pending.size).toBe(0)
    expect(current.view).toMatchObject({
      status: 'ready',
      value: {
        state: 'disconnected',
        generation: undefined,
        items: [{ status: 'configured', canToggle: false, enabled: true }]
      }
    })
    finishRead(snapshot('A-next'))
    await settle()
    dom.act(() => terminated('A', 'gen-B'))
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: snapshot('A-next') })
    read.mockResolvedValueOnce({ state: 'disconnected', items: [] })
    dom.act(() => terminated('A', 'A-next'))
    await settle()
    expect(current.view).toMatchObject({
      status: 'ready',
      value: { state: 'disconnected', items: [{ canToggle: false }] }
    })
    expect(current.view.status === 'ready' && current.view.value.generation).toBeUndefined()
  })

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

  it('keeps a new process operation pending when the retired process write finishes late', async () => {
    dom.render(createElement(Probe, { id: 'A' }))
    await settle()
    let finishOld!: (value: NativeResources) => void
    write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve
        })
    )
    const old = current.toggle(resource)
    read.mockResolvedValueOnce(snapshot('A-next'))
    current.refresh()
    await settle()
    expect(current.pending.size).toBe(0)
    let finishNew!: (value: NativeResources) => void
    write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishNew = resolve
        })
    )
    const next = current.toggle(resource)
    finishOld({ ...snapshot(), items: [{ ...resource, enabled: false, status: 'disabled' }] })
    await old
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: snapshot('A-next') })
    expect([...current.pending]).toEqual(['mcp:native-B'])
    dom.act(() => terminated('A', 'gen-B'))
    expect(current.pending.size).toBe(1)
    finishNew({
      ...snapshot('A-next'),
      items: [{ ...resource, enabled: false, status: 'disabled' }]
    })
    await next
    await settle()
    expect(current.pending.size).toBe(0)
    expect(current.view).toMatchObject({
      value: { generation: 'A-next', items: [{ enabled: false }] }
    })
  })
})

it('updates a peer popup cache from actual shared changes and fences older reads, writes and exited generations', async () => {
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
  current.refresh()
  const disabled = {
    ...snapshot(),
    items: [{ ...resource, enabled: false, status: 'disabled' as const }]
  }
  resourcesChanged({ sessionId: 'session-B', resources: disabled })
  finishRead(snapshot())
  await settle()
  expect(current.view).toMatchObject({ value: { items: [{ enabled: false }] } })
  let finishWrite!: (value: NativeResources) => void
  write.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishWrite = resolve
      })
  )
  const pending = current.toggle(disabled.items[0])
  resourcesChanged({ sessionId: 'session-B', resources: disabled })
  finishWrite(snapshot())
  await pending
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
