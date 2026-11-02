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
  navigate: vi.fn(),
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
  useNavigate: () => fixture.navigate,
  useParams: () => ({ projectId: 'z-id' })
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
  useProjectsState: (await import('../features/projects/store/projectsStore')).useProjectsState,
  ProjectInfoHero: () => null
}))
vi.mock('../features/chat', async () => ({
  Composer: (await import('../features/chat/components/Composer')).Composer,
  LandingHeader: () => null,
  useChatBusy: () => false,
  useChatSession: (await import('../features/chat/store/chatStore')).useChatSession,
  useUsageForTelemetryProvider: () => null,
  ChatTile: () => createElement('div', { 'data-test-chat-tile': '' })
}))
vi.mock('../features/sessions', async () => ({
  ProjectSessionsPanel: () => null,
  ...(await import('../features/sessions/store/sessionsStore'))
}))
import { ProjectLandingPage } from './ProjectLandingPage'

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
const render = (): void =>
  dom.render(createElement(ProjectLandingPage, { onDeleteProject: vi.fn() }))
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
  chatActions.newChat('z-id', 'C:/Alpha')
  useProjectsStore.setState({ list: projects, loading: false })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it.each(['claude', 'opencode'] as const)(
  '0293 project landing opens the project popup with the current project checked (%s)',
  async (backend) => {
    chatActions.setModel(`${backend}-native`, 'vendor/model', 'Model', backend)
    render()
    await settle()
    expect(dom.queryAll('[data-component="landing-project-picker"]')).toHaveLength(1)
    expect(find('data-component', 'landing-project-picker').textContent).toContain('같은 프로젝트')
    open()
    expect(find('aria-label', 'projects.search')).toBeDefined()
    expect(dom.queryAll('[role="menuitemradio"]')).toHaveLength(2)
    expect(dom.queryAll('[role="menuitemradio"]')[0].props['aria-checked']).toBe(true)
    expect(find('role', 'menuitem').textContent).toContain('projects.add')
    expect(fixture.pickDirectory).not.toHaveBeenCalled()
  }
)
it.each(['claude', 'opencode'] as const)(
  '0293 selecting another project changes only the draft and the first send targets it (%s)',
  async (backend) => {
    chatActions.setModel(`${backend}-native`, 'vendor/model', 'Model', backend)
    render()
    await settle()
    const input = find('aria-label', 'chat.composer.inputAria')
    dom.act(() =>
      (input.props.onChange as (e: unknown) => void)({
        currentTarget: { value: 'preserved text', selectionStart: 14, selectionEnd: 14 }
      })
    )
    open()
    dom.click(dom.queryAll('[role="menuitemradio"]')[1])
    expect(getActiveChatSession()).toMatchObject({
      cwd: 'D:/Beta',
      pendingProjectId: 'a-id',
      backend
    })
    expect(dom.query('[data-component="landing-project-menu"]')).toBeNull()
    expect(fixture.navigate).not.toHaveBeenCalled()
    expect(find('aria-label', 'chat.composer.inputAria').props.value).toBe('preserved text')
    dom.click(find('aria-label', 'chat.composer.send'))
    await settle()
    expect(ipc.chatSend.mock.calls[0][0]).toMatchObject({
      cwd: 'D:/Beta',
      projectId: 'a-id',
      text: 'preserved text'
    })
  }
)
it.each([
  ['/selected', null],
  ['D:/Beta', 'a-id'],
  [null, 'z-id']
] as const)('0293 adding a folder follows the new chat rule (%s)', async (folder, projectId) => {
  fixture.pickDirectory.mockResolvedValueOnce(folder)
  render()
  await settle()
  open()
  add()
  await settle()
  expect(getActiveChatSession()).toMatchObject({
    cwd: folder ?? 'C:/Alpha',
    pendingProjectId: projectId
  })
  expect(fixture.navigate).not.toHaveBeenCalled()
})
