import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom, type FakeNode } from '../shared/ui/renderHarness.testfixture'
import {
  chatActions,
  getActiveChatSession,
  seedLandingBackend
} from '../features/chat/store/chatStore'
import { installChatStoreHarness } from '../features/chat/store/chatStore.testHarness'
import { useProjectsStore } from '../features/projects/store/projectsStore'
import type { Project } from '../../../shared/ipc'

const fixture = vi.hoisted(() => ({
  reportError: vi.fn(),
  pickDirectory: vi.fn<() => Promise<string | null>>(async () => '/selected'),
  pickAttachments: vi.fn(async () => [
    { path: '/note.txt', name: 'note.txt', mimeType: 'text/plain', sizeBytes: 8 }
  ]),
  status: vi.fn(async () => ({ isRepo: false, branch: null, detached: false, root: null }))
}))
vi.mock('../shared/errors', () => ({ reportError: fixture.reportError }))
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  const { fakeHooks } = await import('../shared/ui/renderHarness.testfixture')
  return {
    ...actual,
    ...fakeHooks,
    useDeferredValue: (v: unknown) => v,
    useId: () => fakeHooks.useMemo(() => 'test-id', []),
    useImperativeHandle: (
      ref: { current: unknown } | null,
      create: () => unknown,
      deps: unknown[]
    ) =>
      fakeHooks.useLayoutEffect(() => {
        if (ref) ref.current = create()
      }, deps)
  }
})
vi.mock(
  'react-dom',
  async () => (await import('../shared/ui/renderHarness.testfixture')).fakeReactDom
)
// The real vanilla Zustand stores and actions run; only the React hook binding uses the fixture runtime.
vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  const { fakeHooks } = await import('../shared/ui/renderHarness.testfixture')
  const useStore = <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
    fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())) as U
  const bind = <T>(
    init: import('zustand').StateCreator<T>
  ): import('zustand').StoreApi<T> & ((select?: (s: T) => unknown) => unknown) => {
    const store = createStore(init)
    return Object.assign((select: (s: T) => unknown = (s) => s) => useStore(store, select), store)
  }
  return {
    create: (init?: import('zustand').StateCreator<unknown>) => (init ? bind(init) : bind),
    useStore
  }
})
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: null }),
  useNavigate: () => vi.fn()
}))
vi.mock('../features/backend', () => ({
  useBackendLabel: () => 'Claude',
  useBackendCapabilities: () => null
}))
vi.mock('../features/settings', () => ({
  useOpenSettings: () => vi.fn(),
  providerTabId: (id: string) => id
}))
vi.mock('../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../shared/hooks/useAgents', () => ({ useAgents: () => [] }))
vi.mock('../shared/hooks/useSkills', () => ({ useSkills: () => [] }))
vi.mock('../shared/ui/Modal', () => ({ Modal: () => null }))
vi.mock('../shared/api/ipc', async (original) => ({
  ...(await original<typeof import('../shared/api/ipc')>()),
  fileApi: { pickDirectory: fixture.pickDirectory, pickAttachments: fixture.pickAttachments },
  gitApi: { status: fixture.status, branches: async () => ({ current: null, branches: [] }) },
  providerApi: { state: async () => ({ providers: [] }), onState: () => () => {} }
}))
vi.mock('../features/chat/harnesses/common/composer/AttachMenu', () => ({
  AttachMenu: ({ onAction }: { onAction: (a: { type: 'attach' }) => void }) =>
    createElement('button', { 'data-test-attach': '', onClick: () => onAction({ type: 'attach' }) })
}))
vi.mock('../features/projects', async () => ({
  useProjectsState: (await import('../features/projects/store/projectsStore')).useProjectsState
}))
vi.mock('../features/chat', async () => ({
  Landing: (await import('../features/chat/components/Landing')).Landing,
  useChatSession: (await import('../features/chat/store/chatStore')).useChatSession,
  useUsageForTelemetryProvider: () => null,
  ChatTile: () => createElement('div', { 'data-test-chat-tile': '' })
}))
import { NewChatLandingPage } from './NewChatLandingPage'
import { LandingProjectPicker } from '../features/chat/components/LandingProjectPicker'

let dom: FakeDom
let ipc: ReturnType<typeof installChatStoreHarness>
const projects = [
  { id: 'z-id', name: '같은 프로젝트', cwd: 'C:/Alpha' },
  { id: 'a-id', name: '같은 프로젝트', cwd: 'D:/Beta' },
  { id: 'legacy', name: 'Legacy', cwd: null }
] as Project[]
const nodes = (root: FakeNode): FakeNode[] => [root, ...root.children.flatMap(nodes)]
const find = (attribute: string, value?: unknown): FakeNode => {
  const found = nodes(dom.body).find(
    (node) => attribute in node.props && (value === undefined || node.props[attribute] === value)
  )
  expect(found, `${attribute}=${String(value)}`).toBeDefined()
  return found!
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve()
    dom.act(() => {})
  }
}
const open = (): void => dom.click(find('data-component', 'landing-project-picker'))
const add = (): void => dom.click(find('role', 'menuitem'))
const render = (): void => dom.render(createElement(NewChatLandingPage))
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  fixture.pickDirectory.mockReset().mockResolvedValue('/selected')
  ipc = installChatStoreHarness()
  const orca = window.orca
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
  Object.assign(window, { orca })
  Object.assign(window.orca, {
    session: {
      nativeResources: async () => ({ backend: 'claude', state: 'configured', items: [] }),
      onNativeResourcesChanged: () => () => {},
      composerCatalog: async (request: { part: string }) => ({
        part: request.part,
        value: [],
        generation: 'g'
      }),
      releaseComposerCatalog: async () => {},
      onComposerCatalogInvalidated: () => () => {}
    }
  })
  seedLandingBackend(null)
  chatActions.newChat(null, 'C:/Alpha')
  useProjectsStore.setState({ list: projects, loading: false })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('reports a native picker error and preserves the current selection', async () => {
  fixture.pickDirectory.mockRejectedValueOnce(new Error('dialog unavailable'))
  render()
  await settle()
  open()
  add()
  await settle()
  expect(fixture.reportError).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'files.cwd-action.failed', title: 'actionFailed' })
  )
  expect(getActiveChatSession()).toMatchObject({ cwd: 'C:/Alpha', pendingProjectId: null })
})

it.each(['claude', 'opencode'] as const)(
  'carries catalog loading through the %s composer while Add stays available',
  async (backend) => {
    chatActions.setModel(`${backend}-native`, 'vendor/model', 'Model', backend)
    useProjectsStore.setState({ list: [], loading: true })
    render()
    await settle()
    open()
    expect(find('role', 'status').textContent).toBe('projects.loading')
    expect(find('aria-busy', true)).toBeDefined()
    expect(find('role', 'menuitem').props.disabled).toBe(false)
    expect(fixture.pickDirectory).not.toHaveBeenCalled()
  }
)

it('removes deleted catalog rows from the open popup without restoring their IDs', async () => {
  useProjectsStore.setState({ list: [projects[0], { ...projects[1], id: 'deleted-row-id' }] })
  render()
  await settle()
  open()
  const staleRow = dom.queryAll('[role="menuitemradio"]')[1]
  dom.act(() => {
    useProjectsStore.setState({ list: [projects[0]] })
    chatActions.detachProject('deleted-row-id')
  })
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.props.title)).toEqual(['C:/Alpha'])
  dom.click(staleRow)
  expect(getActiveChatSession().pendingProjectId).toBeNull()
})

it.each(['claude', 'opencode'] as const)(
  'carries the page catalog through the %s composer and sends selection with preserved draft and attachments',
  async (backend) => {
    chatActions.setModel(`${backend}-native`, 'vendor/model', 'Model', backend)
    render()
    await settle()
    const input = find('aria-label', 'chat.composer.inputAria')
    dom.act(() =>
      (input.props.onChange as (event: unknown) => void)({
        currentTarget: { value: 'preserved text', selectionStart: 14, selectionEnd: 14 }
      })
    )
    dom.click(find('data-test-attach'))
    await settle()
    open()
    expect(fixture.pickDirectory).not.toHaveBeenCalled()
    expect(dom.activeElement.props['aria-label']).toBe('projects.search')
    const rows = dom.queryAll('[role="menuitemradio"]')
    expect(rows.map((row) => row.props.title)).toEqual(['C:/Alpha', 'D:/Beta'])
    expect(rows[0].props['aria-checked']).toBe(true)
    expect(rows[0].props.className).toContain('bg-fill-uncontained-hover')
    dom.click(rows[1])
    expect(getActiveChatSession()).toMatchObject({
      cwd: 'D:/Beta',
      pendingProjectId: 'a-id',
      backend
    })
    expect(find('aria-label', 'chat.composer.inputAria').props.value).toBe('preserved text')
    expect(find('title', 'note.txt')).toBeDefined()
    expect(dom.activeElement.props['data-component']).toBe('landing-project-picker')
    open()
    expect(dom.queryAll('[role="menuitemradio"]')[1].props['aria-checked']).toBe(true)
    dom.key('Escape')
    dom.click(find('aria-label', 'chat.composer.send'))
    await settle()
    expect(ipc.chatSend.mock.calls[0][0]).toMatchObject({
      cwd: 'D:/Beta',
      projectId: 'a-id',
      text: 'preserved text',
      attachments: [expect.objectContaining({ name: 'note.txt' })]
    })
  }
)

it('searches paths, clears search on dismiss, and moves keyboard focus through rows', async () => {
  render()
  await settle()
  open()
  const input = find('aria-label', 'projects.search')
  dom.act(() => (input.props.onChange as (e: unknown) => void)({ target: { value: '  beta ' } }))
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.props.title)).toEqual(['D:/Beta'])
  dom.key('ArrowDown')
  expect(dom.activeElement.props.title).toBe('D:/Beta')
  dom.key('Escape')
  expect(dom.query('[data-component="landing-project-menu"]')).toBeNull()
  expect(dom.activeElement.props['data-component']).toBe('landing-project-picker')
  open()
  expect(find('aria-label', 'projects.search').props.value).toBe('')
  dom.mouseDown(dom.createNode('button'))
  expect(dom.query('[data-component="landing-project-menu"]')).toBeNull()
})

it('opens the native picker only from Add and matches its result against the latest catalog', async () => {
  const pending = Promise.withResolvers<string | null>()
  fixture.pickDirectory.mockReturnValueOnce(pending.promise)
  render()
  await settle()
  open()
  add()
  add()
  expect(fixture.pickDirectory).toHaveBeenCalledOnce()
  expect(getActiveChatSession().cwd).toBe('C:/Alpha')
  dom.act(() =>
    useProjectsStore.setState({
      list: [...projects, { id: 'late-id', name: 'Late', cwd: 'E:/late' } as Project]
    })
  )
  pending.resolve('e:\\LATE\\')
  await settle()
  expect(getActiveChatSession()).toMatchObject({ pendingProjectId: 'late-id', cwd: 'e:\\LATE\\' })
  expect(ipc.chatSend).not.toHaveBeenCalled()
  open()
  fixture.pickDirectory.mockResolvedValueOnce('F:/new')
  add()
  await settle()
  expect(getActiveChatSession()).toMatchObject({ pendingProjectId: null, cwd: 'F:/new' })
  expect(useProjectsStore.getState().list).toHaveLength(4)
  expect(ipc.settingsSet).toHaveBeenCalledWith({ lastCwd: 'F:/new' })
})

it.each(['cancel', 'root', 'new-draft', 'send', 'unmount'] as const)(
  'does not apply a %s folder result to the wrong draft',
  async (kind) => {
    const pending = Promise.withResolvers<string | null>()
    fixture.pickDirectory.mockReturnValueOnce(pending.promise)
    render()
    await settle()
    open()
    add()
    if (kind === 'new-draft') dom.act(() => chatActions.newChat(null, 'G:/replacement'))
    if (kind === 'send')
      dom.act(() => {
        chatActions.send('started')
      })
    if (kind === 'unmount') dom.unmount()
    pending.resolve(kind === 'cancel' ? null : kind === 'root' ? 'C:/' : 'E:/stale')
    await settle()
    expect(getActiveChatSession().cwd).not.toBe('E:/stale')
    expect(ipc.settingsSet.mock.calls.filter(([p]) => 'lastCwd' in p)).toHaveLength(0)
    if (kind === 'root') expect(getActiveChatSession().extraDirRejection).toBe('root')
  }
)

it('keeps Add available for an empty catalog and empty search result', async () => {
  dom.render(
    createElement(LandingProjectPicker, {
      cwd: null,
      inflight: false,
      projects: { items: [], loading: false },
      variant: 'flat'
    })
  )
  open()
  expect(find('role', 'status').textContent).toBe('projects.emptyFolders')
  add()
  await settle()
  expect(getActiveChatSession()).toMatchObject({ cwd: '/selected', pendingProjectId: null })
})
