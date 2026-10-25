import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialChatState, type ChatState } from '../features/chat/reducer/chatReducer'
import { installFakeDom, type FakeDom, type FakeNode } from '../shared/ui/renderHarness.testfixture'

const fixture = vi.hoisted(() => ({
  session: {} as ChatState,
  pickDirectory: vi.fn(async () => '/selected'),
  checkout: vi.fn(async () => ({
    ok: true,
    branch: 'feature',
    status: { isRepo: true, branch: 'feature', detached: false, root: '/repo' }
  })),
  status: vi.fn(async () => ({ isRepo: true, branch: 'main', detached: false, root: '/repo' })),
  pickAttachments: vi.fn(async () => [
    { path: '/note.txt', name: 'note.txt', mimeType: 'text/plain', sizeBytes: 8 }
  ]),
  send: vi.fn(() => true)
}))

// Production page, Composer, input/attachment controller, CwdPanel and branch controls run intact.
// Replace the React/browser runtime and external service boundaries only.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  const { fakeHooks } = await import('../shared/ui/renderHarness.testfixture')
  return {
    ...actual,
    ...fakeHooks,
    useDeferredValue: (value: unknown) => value,
    useId: () => fakeHooks.useMemo(() => 'test-id', []),
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
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
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../shared/ui/renderHarness.testfixture')
  return {
    ...actual,
    useStore: <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
      fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())) as U
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
vi.mock('../shared/ui/Popover', () => ({
  Popover: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? children : null)
}))
vi.mock('../shared/ui/Modal', () => ({ Modal: () => null }))
vi.mock('../shared/api/ipc', async (original) => ({
  ...(await original<typeof import('../shared/api/ipc')>()),
  fileApi: { pickDirectory: fixture.pickDirectory, pickAttachments: fixture.pickAttachments },
  gitApi: {
    status: fixture.status,
    checkout: fixture.checkout,
    branches: async () => ({
      current: fixture.checkout.mock.calls.length ? 'feature' : 'main',
      branches: ['main', 'feature']
    })
  },
  providerApi: { state: async () => ({ providers: [] }), onState: () => () => {} }
}))
vi.mock('../features/chat/store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(fixture.session),
  useChatStore: (select: (state: { activeKey: string }) => unknown) =>
    select({ activeKey: 'draft' }),
  turnEndTick: () => 0,
  useChatBusy: () => false,
  useChatResponding: () => false,
  useChatResidualSteer: () => 0,
  useNewChatPending: () => false,
  useProjectConcurrencyCount: () => 0,
  chatActions: {
    captureDiffRequirementSnapshot: () => ({
      sessionKey: 'draft',
      sessionId: null,
      ids: [],
      revision: 0,
      anchors: []
    }),
    setPendingCwd: (cwd: string) => {
      fixture.session.cwd = cwd
    },
    setWorktreeIsolation: (checked: boolean) => {
      fixture.session.worktreeIsolation = checked
    },
    setWorktreeBaseRef: (branch: string) => {
      fixture.session.worktreeBaseRef = branch
    },
    send: fixture.send
  }
}))
vi.mock('../features/chat/harnesses/common/composer/AttachMenu', () => ({
  AttachMenu: ({ onAction }: { onAction: (action: { type: 'attach' }) => void }) =>
    createElement('button', { 'data-test-attach': '', onClick: () => onAction({ type: 'attach' }) })
}))
vi.mock('../features/projects', () => ({
  useProjectsState: (select: (s: { list: unknown[] }) => unknown) => select({ list: [] })
}))
vi.mock('../features/chat', async () => ({
  Landing: (await import('../features/chat/components/Landing')).Landing,
  harnessSurfaces: (await import('../features/chat/harnesses/presentation')).harnessSurfaces,
  Composer: (await import('../features/chat/components/Composer')).Composer,
  AgentModeToggle: (await import('../features/chat/components/AgentModeToggle')).AgentModeToggle,
  OpenCodeWordmark: (await import('../features/chat/harnesses/opencode/Wordmark')).OpenCodeWordmark,
  useChatSession: (await import('../features/chat/store/chatStore')).useChatSession,
  useUsageForTelemetryProvider: () => null,
  ChatTile: () => createElement('div', { 'data-test-chat-tile': '' })
}))
vi.mock('../features/chat/components/composer/GitRow', () => ({
  GitRow: () => createElement('div', { 'data-test-git-row': '' })
}))
import { Composer } from '../features/chat/components/Composer'
import { NewChatLandingPage } from './NewChatLandingPage'

let dom: FakeDom
const nodes = (root: FakeNode): FakeNode[] => [root, ...root.children.flatMap(nodes)]
const find = (attribute: string, value?: unknown): FakeNode => {
  const node = nodes(dom.body).find(
    (node) => attribute in node.props && (value === undefined || node.props[attribute] === value)
  )
  expect(node, `${attribute}=${String(value)}`).toBeDefined()
  return node!
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    dom.act(() => {})
  }
}
const render = (): void => dom.render(createElement(NewChatLandingPage))

beforeEach(() => {
  vi.useFakeTimers()
  fixture.session = { ...initialChatState, backend: 'claude', agentKind: 'code', cwd: '/repo' }
  vi.clearAllMocks()
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('new conversation harness layout', () => {
  it('renders the harness landing and preserves draft and attachment state', async () => {
    render()
    await settle()
    const input = find('aria-label', 'chat.composer.inputAria')
    dom.act(() =>
      (input.props.onChange as (event: unknown) => void)({
        currentTarget: { value: 'keep this draft', selectionStart: 15, selectionEnd: 15 }
      })
    )
    dom.click(find('data-test-attach'))
    await settle()
    expect(fixture.pickAttachments).toHaveBeenCalledOnce()
    expect(find('title', 'note.txt')).toBeDefined()
    const before = nodes(dom.body)
    expect(before.indexOf(find('data-surface', 'cwd-panel'))).toBeLessThan(before.indexOf(input))

    for (const backend of ['opencode', 'claude', 'opencode'] as const) {
      fixture.session = { ...fixture.session, backend }
      render()
      await settle()
      expect(find('aria-label', 'chat.composer.inputAria').props.value).toBe('keep this draft')
      expect(find('title', 'note.txt')).toBeDefined()
      const tree = nodes(dom.body)
      const context = find('data-surface', 'cwd-panel')
      if (backend === 'opencode') {
        expect(tree.indexOf(find('data-surface', 'opencode-wordmark'))).toBeLessThan(
          tree.indexOf(find('aria-label', 'chat.composer.inputAria'))
        )
        expect(tree.indexOf(context)).toBeGreaterThan(
          tree.indexOf(find('aria-label', 'chat.composer.inputAria'))
        )
        expect(context.props['data-appearance']).toBe('opencode')
        expect(tree.some((node) => 'data-agent-mode-controls' in node.props)).toBe(false)
      } else {
        expect(tree.some((node) => 'data-agent-mode-controls' in node.props)).toBe(true)
        expect(tree.some((node) => node.props['data-surface'] === 'opencode-wordmark')).toBe(false)
        expect(tree.indexOf(context)).toBeLessThan(
          tree.indexOf(find('aria-label', 'chat.composer.inputAria'))
        )
      }
    }
  })

  it('selects workspace and branch from the footer', async () => {
    fixture.session.backend = 'opencode'
    render()
    await settle()
    dom.click(find('aria-label', 'chat.composer.cwdSelectAria'))
    await settle()
    expect(fixture.session.cwd).toBe('/selected')
    render()
    await settle()
    expect(fixture.status).toHaveBeenCalledWith('/selected')
    dom.click(find('title', 'chat.composer.branchTitle'))
    await settle()
    dom.click(find('title', 'feature'))
    await settle()
    expect(fixture.checkout).toHaveBeenCalledWith({ cwd: '/selected', branch: 'feature' })
    expect(dom.body.textContent).toContain('feature')

    const checkbox = find('type', 'checkbox')
    dom.act(() =>
      (checkbox.props.onChange as (event: unknown) => void)({ currentTarget: { checked: true } })
    )
    render()
    expect(fixture.session.worktreeIsolation).toBe(true)
    dom.click(find('title', 'chat.composer.branchTitle'))
    await settle()
    dom.click(find('title', 'main'))
    await settle()
    expect(fixture.session.worktreeBaseRef).toBe('main')
    expect(fixture.checkout).toHaveBeenCalledOnce()
  })

  it('leaves the landing after the first optimistic message', () => {
    fixture.session.backend = 'opencode'
    render()
    fixture.session.messages = [
      { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'start' }] }
    ]
    render()
    expect(find('data-test-chat-tile')).toBeDefined()
    expect(nodes(dom.body).some((node) => node.props['data-surface'] === 'cwd-panel')).toBe(false)
  })
})

it('shares the landing frame and hero slot across harnesses', async () => {
  const classes: unknown[] = []
  for (const backend of ['claude', 'opencode'] as const) {
    fixture.session.backend = backend
    render()
    await settle()
    const root = find('data-surface', 'new-chat-landing')
    const align = root.children[0]
    const column = align.children[0]
    const hero = find('data-surface', 'landing-hero-slot')
    classes.push([root, align, column, hero].map((node) => node.props.className))
    expect(align.props.className).toContain('items-center')
    expect(column.props.className).toContain('max-w-[720px]')
    expect(hero.props.className).toContain('min-h-')
    expect(hero.props.className).toContain('justify-end')
    if (backend === 'opencode') {
      expect(find('data-surface', 'opencode-landing-context').props.className).toContain('absolute')
      expect(
        nodes(dom.body).find((node) =>
          String(node.props.className).includes('app-frame-composer relative')
        )?.props.className
      ).toContain('pt-[calc(3.5rem+2px)]')
    }
  }
  expect(classes[0]).toEqual(classes[1])
})
it('renders the git row only for harnesses that allow it', () => {
  for (const [backend, agentKind, visible] of [
    ['claude', 'code', true],
    ['opencode', 'code', false],
    ['claude', 'work', false]
  ] as const) {
    fixture.session = { ...fixture.session, backend, agentKind, sessionId: 'started' }
    dom.render(createElement(Composer, { backendLabel: backend, canAbort: true, showGitRow: true }))
    expect(nodes(dom.body).some((node) => 'data-test-git-row' in node.props)).toBe(visible)
  }
})
