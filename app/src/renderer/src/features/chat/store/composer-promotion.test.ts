import { createElement, Fragment } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useChatStore, ingestChatEvent } from './chatStore'
import { initialChatState, type ChatState } from '../reducer/chatReducer'
import { composerModule } from '../harnesses/opencode/composer/Module'
import { composerAgentStore } from '../harnesses/opencode/composer/composerAgentStore'
import type {
  ComposerCatalogRequest,
  ComposerCatalogResult
} from '../../../../../shared/composer-catalog'
import type { ComposerControlProps } from '../harnesses/contracts'
import { ComposerInputController } from '../harnesses/common/composer/ComposerInputController'
import { composerModelStore } from '../harnesses/opencode/composer/composerModelStore'

vi.mock('react', async (original) => {
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return {
    ...(await original<typeof import('react')>()),
    ...fakeHooks,
    useDeferredValue: <T>(value: T): T => value,
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
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  const { createStore } = await import('zustand/vanilla')
  const useStore = <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
    fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())) as U
  const bind = <T>(initializer: import('zustand').StateCreator<T>): unknown => {
    const store = createStore(initializer)
    return Object.assign(<U>(selector: (state: T) => U): U => useStore(store, selector), store)
  }
  return {
    ...actual,
    useStore,
    create: (initializer?: import('zustand').StateCreator<unknown>) =>
      initializer ? bind(initializer) : bind
  }
})
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string): string => key }) }))

let dom: FakeDom,
  serial = 0
const query = vi.fn<(request: ComposerCatalogRequest) => Promise<ComposerCatalogResult>>()
const release = vi.fn(async () => {})
let saved: ReturnType<typeof Promise.withResolvers<ComposerCatalogResult>>
let managedChanged: () => void
function seed(overrides: Partial<ChatState> = {}): void {
  useChatStore.setState({
    sessions: {
      draft: {
        session: {
          ...initialChatState,
          sessionId: null,
          backend: 'opencode',
          cwd: 'C:/same',
          agentKind: 'code',
          providerKey: 'team',
          modelFamily: 'distinct/model',
          harnessAgent: 'distinct-agent',
          modelVariant: 'deep',
          worktreeIsolation: false,
          ...overrides
        },
        draftGeneration: ++serial,
        live: { text: '', reasoning: '' },
        subagentMeta: {}
      }
    },
    activeKey: 'draft',
    pendingNewChatKey: 'draft',
    newChatQueue: [],
    recentsEpoch: 0
  })
}
const props: ComposerControlProps = {
  agents: [],
  providerKey: 'team',
  modelFamily: 'distinct/model',
  model: null
}
function Controls(): React.ReactElement {
  const providerKey = useChatStore((state) => state.sessions[state.activeKey].session.providerKey)
  return createElement(
    Fragment,
    null,
    createElement(composerModule.ModeControl, { ...props, providerKey }),
    createElement(composerModule.EffortControl, { ...props, providerKey })
  )
}
function render(): void {
  dom.render(createElement(Controls))
}
async function settle(): Promise<void> {
  for (let n = 0; n < 20; n++) await Promise.resolve()
  dom.act(() => {})
}
beforeEach(() => {
  composerModelStore.clear()
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
  composerAgentStore.getState().invalidate(composerAgentStore.getState().revision + 1)
  saved = Promise.withResolvers<ComposerCatalogResult>()
  query.mockReset().mockImplementation(async (request) =>
    request.scope.sessionId
      ? saved.promise
      : request.part === 'agents'
        ? { part: 'agents', value: [{ name: 'distinct-agent' }], generation: 'retained' }
        : {
            part: 'models',
            value: [{ id: 'distinct/model', variants: ['deep'] }],
            generation: 'retained'
          }
  )
  release.mockClear()
  Object.assign(window, {
    orca: {
      session: {
        composerCatalog: query,
        releaseComposerCatalog: release,
        onComposerCatalogInvalidated: () => () => {},
        nativeResources: async () => ({ state: 'disconnected', items: [] }),
        onManagedMcpChanged: (callback: () => void) => {
          managedChanged = callback
          return () => {}
        }
      },
      settings: { set: async () => ({}) },
      skills: { list: async () => [] },
      provider: { state: async () => ({ providers: [] }), onState: () => () => {} },
      file: { pathForFile: () => '', list: async () => [], pickAttachments: async () => [] }
    }
  })
  seed()
})
afterEach(async () => {
  dom.unmount()
  await vi.runOnlyPendingTimersAsync()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('preserves only the matching promoted catalog through the real store, hook and controls', async () => {
  render()
  await settle()
  expect(query.mock.calls.map(([request]) => request.part).sort()).toEqual(['agents', 'models'])
  dom.click(dom.query('[aria-label="harness.agent"]')!)
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual([
    'distinct-agent'
  ])
  dom.click(dom.queryAll('[role="menuitemradio"]')[0])
  expect(dom.query('[aria-label="harness.variant"]')?.textContent).toContain('deep')
  const owner = query.mock.calls[0][0].owner
  dom.act(() => ingestChatEvent({ type: 'session.updated', sessionId: 'saved', patch: {} }))
  await settle()
  expect(useChatStore.getState().activeKey).toBe('saved')
  expect(dom.query('[aria-label="harness.variant"]')?.textContent).toContain('deep')
  expect(query.mock.calls[2][0]).toMatchObject({
    part: 'models',
    refresh: false,
    scope: { sessionId: 'saved' }
  })
  expect(query.mock.calls[2][0].owner).not.toBe(owner)
  expect(release).not.toHaveBeenCalled()
  saved.resolve({
    part: 'models',
    generation: 'retained',
    value: [{ id: 'distinct/model', variants: ['deep'] }]
  })
  await settle()
  expect(release).toHaveBeenCalledExactlyOnceWith(owner)
  managedChanged()
  await settle()
  expect(query).toHaveBeenCalledTimes(3)
  dom.unmount()
  render()
  await settle()
  expect(query).toHaveBeenCalledTimes(3)
  dom.click(dom.query('[aria-label="harness.variant"]')!)
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual([
    'harness.defaultVariant',
    'deep'
  ])
})

it.each([
  ['cwd', { cwd: 'C:/worktree' }, {}],
  ['worktree reservation', {}, { worktreeIsolation: true }]
] as const)(
  'seeds only non-authoritative models after a %s mismatch',
  async (_label, patch, before) => {
    seed(before)
    render()
    await settle()
    dom.act(() => ingestChatEvent({ type: 'session.updated', sessionId: 'mismatch', patch }))
    await settle()
    dom.click(dom.query('[aria-label="harness.variant"]')!)
    expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toContain('deep')
    expect(dom.query('[role="group"]')?.props['aria-busy']).toBe(true)
    expect(useChatStore.getState().sessions.mismatch.session.modelVariant).toBe('deep')
    saved.resolve({
      part: 'models',
      generation: 'new-target',
      value: [{ id: 'distinct/model', variants: ['fresh'] }]
    })
    await settle()
    expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toContain('fresh')
  }
)

it.each(['input', 'paste', 'attachment', 'menu', 'send'] as const)(
  'requests MCP once through the real controller and OpenCode slot on first %s intent',
  async (intent) => {
    query.mockImplementation(async (request) => {
      switch (request.part) {
        case 'agents':
          return { part: 'agents', value: [], generation: 'intent' }
        case 'models':
          return { part: 'models', value: [], generation: 'intent' }
        case 'mcp':
          return { part: 'mcp', value: [], generation: 'intent' }
        case 'plugins':
          return { part: 'plugins', value: [], generation: 'intent' }
      }
    })
    const send = vi.fn(() => false)
    dom.render(
      createElement(
        Fragment,
        null,
        createElement(composerModule.EffortControl, props),
        createElement(ComposerInputController, {
          presentation: composerModule,
          active: true,
          backendLabel: 'OpenCode',
          canAbort: false,
          inflight: false,
          steerBlocked: false,
          toolApprovalPending: false,
          cwd: 'C:/same',
          initialDraft: intent === 'send' ? 'send this' : undefined,
          onSend: send,
          onCancel: vi.fn(),
          controlsStart: null,
          controlsEnd: null,
          diffRequirementSnapshot: {
            sessionKey: 'draft',
            sessionId: null,
            ids: [],
            revision: 0,
            anchors: []
          },
          onClearDiffRequirementsIfUnchanged: vi.fn()
        })
      )
    )
    await settle()
    expect(query.mock.calls.filter(([r]) => r.part === 'mcp')).toHaveLength(0)
    const shell = dom.query('[data-harness="opencode"]')!
    const textarea = dom.query('[aria-label="chat.composer.inputAria"]')!
    Object.assign(textarea, { setSelectionRange: () => {} })
    const trigger = (): void => {
      if (intent === 'input')
        (textarea.props.onChange as (event: unknown) => void)({
          currentTarget: { value: 'hello', selectionStart: 5, selectionEnd: 5 }
        })
      if (intent === 'paste')
        (shell.props.onPaste as (event: unknown) => void)({
          clipboardData: { files: [], items: [] }
        })
      if (intent === 'attachment')
        (shell.props.onDrop as (event: unknown) => void)({
          preventDefault: vi.fn(),
          dataTransfer: { files: [] }
        })
      if (intent === 'menu') dom.click(dom.query('[title="chat.composer.attachMenuTitle"]')!)
      if (intent === 'send')
        (textarea.props.onKeyDown as (event: unknown) => void)({
          key: 'Enter',
          shiftKey: false,
          nativeEvent: {},
          preventDefault: vi.fn()
        })
    }
    dom.act(trigger)
    await settle()
    dom.act(trigger)
    await settle()
    expect(query.mock.calls.filter(([r]) => r.part === 'mcp')).toHaveLength(1)
    if (intent === 'send') expect(send).toHaveBeenCalled()
  }
)

it('does not inherit the catalog selected before the provider changed', async () => {
  render()
  await settle()
  const state = useChatStore.getState()
  dom.act(() => {
    useChatStore.setState({
      sessions: {
        ...state.sessions,
        draft: {
          ...state.sessions.draft,
          session: { ...state.sessions.draft.session, providerKey: 'other' }
        }
      }
    })
    ingestChatEvent({ type: 'session.updated', sessionId: 'other-provider', patch: {} })
  })
  await settle()
  expect(query.mock.calls.at(-1)?.[0].scope.sessionId).toBe('other-provider')
  dom.click(dom.query('[aria-label="harness.variant"]')!)
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).not.toContain('deep')
  saved.resolve({ part: 'models', generation: 'other-provider', value: [] })
  await settle()
})

it('promotes the pending draft without moving the other active draft catalog', async () => {
  render()
  await settle()
  const pending = useChatStore.getState().sessions.draft
  dom.act(() =>
    useChatStore.setState({
      sessions: {
        ...useChatStore.getState().sessions,
        other: {
          ...pending,
          draftGeneration: ++serial,
          session: { ...pending.session, cwd: 'C:/other' }
        }
      },
      activeKey: 'other'
    })
  )
  await settle()
  const otherQueries = query.mock.calls.filter(([r]) => r.scope.cwd === 'C:/other').length
  dom.act(() => ingestChatEvent({ type: 'session.updated', sessionId: 'saved-pending', patch: {} }))
  await settle()
  expect(useChatStore.getState().activeKey).toBe('other')
  expect(query.mock.calls.filter(([r]) => r.scope.cwd === 'C:/other')).toHaveLength(otherQueries)
  expect(
    query.mock.calls
      .filter(([r]) => r.scope.sessionId === 'saved-pending')
      .every(([r]) => r.scope.cwd === 'C:/same')
  ).toBe(true)
  saved.resolve({ part: 'models', generation: 'retained', value: [] })
  await settle()
})
