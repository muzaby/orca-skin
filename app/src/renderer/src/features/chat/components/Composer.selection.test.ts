import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'fixture-id'
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
// Keep production state/actions; bind Zustand subscriptions to the test React runtime.
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  const create = (initializer?: import('zustand').StateCreator<unknown>): unknown => {
    if (!initializer) return create
    const store = actual.createStore(initializer)
    return Object.assign(
      (select: (state: unknown) => unknown = (state) => state) =>
        fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())),
      store
    )
  }
  return { ...actual, create }
})
vi.mock('../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key })
}))
const catalog = vi.hoisted(() => ({
  agents: [] as import('../../../../../shared/ipc').AgentEnvironment[]
}))
vi.mock('../../../shared/hooks/useAgents', () => ({ useAgents: () => catalog.agents }))
vi.mock('../harnesses/registries/composer', async (original) => {
  const { composerHarness } = await original<typeof import('../harnesses/registries/composer')>()
  const { createElement } = await import('react')
  return {
    composerHarness: (backend: Parameters<typeof composerHarness>[0]) => ({
      ...composerHarness(backend),
      Status: () => null,
      Requests: () => null,
      AboveInput: () => null,
      ModeControl: backend === 'claude' ? composerHarness(backend).ModeControl : () => null,
      EffortControl: () => null,
      Chip: ({ label, onClick }: { label: string; onClick: () => void }) =>
        createElement('button', { 'data-model-label': true, onClick }, label)
    })
  }
})
vi.mock('../harnesses/common/composer/ComposerInputController', () => ({
  ComposerInputController: ({
    controlsStart,
    controlsEnd
  }: {
    controlsStart: import('react').ReactNode
    controlsEnd: import('react').ReactNode
  }) => createElement('div', null, controlsStart, controlsEnd)
}))
vi.mock('./composer/GitRow', () => ({ GitRow: () => null }))
import { createElement } from 'react'
import { Composer } from './Composer'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { installChatStoreHarness } from '../store/chatStore.testHarness'
import { chatActions, getActiveChatSession, seedLandingBackend } from '../store/chatStore'
import type { AgentEnvironment } from '../../../../../shared/ipc'

function agent(adapter: 'claude' | 'opencode'): AgentEnvironment {
  return {
    key: `${adapter}-local`,
    adapter,
    supported: true,
    models: [
      {
        alias: `${adapter}-model`,
        model: `${adapter}/model`,
        isCustom: true,
        isDefault: true,
        oneMillionContext: false
      }
    ]
  }
}
let dom: FakeDom
function render(): void {
  dom.render(createElement(Composer, { backendLabel: 'OpenCode', canAbort: true }))
}
beforeEach(() => {
  vi.useFakeTimers()
  installChatStoreHarness({ sessionId: null, backend: 'opencode', agentKind: 'code' })
  const oo = window.oo
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  Object.assign(window, { oo })
  catalog.agents = [agent('claude')]
})
afterEach(() => {
  dom.unmount()
  vi.restoreAllMocks()
  seedLandingBackend(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('keeps the explicitly chosen harness and empty model label until its models arrive', () => {
  chatActions.setModel(null, null, null, 'opencode', { explicitHarness: true })
  render()
  expect(dom.query('[data-model-label]')?.textContent).toBe('chat.composer.modelFallback')
  expect(getActiveChatSession()).toMatchObject({ backend: 'opencode', providerKey: null })
  catalog.agents = [agent('claude'), agent('opencode')]
  render()
  expect(getActiveChatSession()).toMatchObject({
    backend: 'opencode',
    providerKey: 'opencode-local',
    modelFamily: 'opencode/model',
    harnessExplicitlySelected: true
  })
  expect(dom.query('[data-model-label]')?.textContent).toContain('opencode')
})

it('still falls back from an unavailable remembered harness in an ordinary draft', () => {
  render()
  expect(getActiveChatSession()).toMatchObject({
    backend: 'claude',
    providerKey: 'claude-local',
    harnessExplicitlySelected: false
  })
  expect(dom.query('[data-model-label]')?.textContent).toContain('claude')
})

it('selects the supported Claude model when unavailable OpenCode models are present', () => {
  catalog.agents = [
    { ...agent('opencode'), supported: false, unavailable: 'missing' },
    agent('claude')
  ]
  render()
  expect(getActiveChatSession()).toMatchObject({ backend: 'claude', providerKey: 'claude-local' })
  expect(dom.query('[data-model-label]')?.textContent).toContain('claude')
})

it('shows each loaded session model instead of the provider default, across navigation and a fresh renderer store', async () => {
  const { useChatStore } = await import('../store/chatStore')
  const { initialChatState } = await import('../reducer/chatReducer')
  const saved = (id: string): import('../../../../../shared/ipc').LoadedSession => ({
    id,
    backend: 'claude' as const,
    agentKind: 'code' as const,
    title: id,
    providerKey: 'claude-local',
    modelFamily: id === 'A' ? 'claude-sonnet-4-6[1m]' : 'claude-opus-4-6',
    messages: []
  })
  Object.assign(window.oo, {
    session: {
      load: async (id: string) => saved(id),
      refresh: async () => ({ status: 'unchanged' })
    }
  })
  Object.assign(window.oo.chat, {
    backgroundState: async () => ({ tasks: [], connections: [], revision: 0 })
  })
  catalog.agents = [
    {
      ...agent('claude'),
      models: [
        {
          alias: 'opus',
          model: 'claude-opus-4-6',
          isCustom: false,
          isDefault: true,
          oneMillionContext: false
        },
        {
          alias: 'sonnet',
          model: 'claude-sonnet-4-6',
          isCustom: false,
          isDefault: false,
          oneMillionContext: true
        }
      ]
    }
  ]
  for (const id of ['A', 'B', 'A']) {
    await chatActions.loadSession(id)
    render()
    expect(getActiveChatSession().modelFamily).toBe(saved(id).modelFamily)
    expect(dom.query('[data-model-label]')?.textContent).toContain(saved(id).modelFamily)
    expect(getActiveChatSession().permissionMode).toBe('auto_classified')
  }
  useChatStore.setState((s) => ({
    sessions: { new: { ...s.sessions[s.activeKey], session: { ...initialChatState } } },
    activeKey: 'new'
  }))
  await chatActions.loadSession('A')
  render()
  expect(getActiveChatSession()).toMatchObject({
    modelFamily: 'claude-sonnet-4-6[1m]',
    modelAlias: 'sonnet'
  })
  expect(dom.query('[data-model-label]')?.textContent).toContain('claude-sonnet-4-6[1m]')
})

it.each(['new', 'fork'] as const)(
  'records the production model menu pick only in a %s conversation',
  async (kind) => {
    const { useChatStore } = await import('../store/chatStore')
    const { useHarnessAvailabilityStore } =
      await import('../../../shared/stores/harnessAvailabilityStore')
    useHarnessAvailabilityStore.setState(({ byId }) => ({
      byId: { ...byId, opencode: { id: 'opencode', installed: true, usable: true } }
    }))
    catalog.agents = [agent('claude'), agent('opencode')]
    chatActions.setModel('claude-local', 'claude/model', 'claude-model', 'claude')
    if (kind === 'fork') {
      useChatStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          [state.activeKey]: {
            ...state.sessions[state.activeKey],
            session: {
              ...state.sessions[state.activeKey].session,
              sessionId: 'source',
              agentKindLocked: true
            }
          }
        }
      }))
      expect(chatActions.startForkDraft()).toBe(true)
      catalog.agents[0].models.push({
        ...catalog.agents[0].models[0],
        model: 'claude/other',
        alias: 'other',
        isDefault: false
      })
    }
    render()
    const set = vi.mocked(window.oo.settings.set)
    set.mockClear()
    dom.click(dom.query('[data-model-label]')!)
    const target = dom
      .queryAll('[role="menuitemradio"]')
      .find((node) =>
        node.textContent.includes(kind === 'new' ? 'opencode-model' : 'claude/other')
      )!
    expect(target).toBeDefined()
    dom.click(target)
    const preferences = set.mock.calls.filter(([patch]) => 'lastBackend' in patch)
    if (kind === 'new') {
      expect(getActiveChatSession().backend).toBe('opencode')
      expect(preferences).toEqual([[{ lastBackend: 'opencode' }]])
    } else {
      expect(getActiveChatSession().modelFamily).toBe('claude/other')
      expect(preferences).toEqual([])
    }
  }
)

it.each(['default', 'hydrate', 'alias', 'evidence'] as const)(
  '0304 carries alias evidence through Composer %s',
  (source) => {
    const fakeWindow = window
    installChatStoreHarness({
      sessionId: null,
      backend: 'claude',
      agentKind: 'work',
      ...(source === 'default' ? {} : { providerKey: 'claude-local' }),
      ...(source === 'alias' || source === 'evidence'
        ? { modelFamily: 'haiku', modelAlias: source === 'alias' ? null : 'haiku' }
        : {})
    })
    const oo = window.oo
    vi.stubGlobal('window', fakeWindow)
    Object.assign(window, { oo })
    catalog.agents = [
      {
        ...agent('claude'),
        models: [
          {
            alias: 'haiku',
            model: 'haiku',
            resolvedModel: 'claude-haiku-5-5',
            isCustom: false,
            isDefault: true,
            oneMillionContext: false
          }
        ]
      }
    ]
    const controlModel: NonNullable<
      Parameters<
        typeof import('../harnesses/claude/composer/Controls').ClaudeModeControl
      >[0]['model']
    > = { alias: 'haiku', model: 'haiku', resolvedModel: 'claude-haiku-5-5', isCustom: false }
    catalog.agents[0].models[0] = { ...catalog.agents[0].models[0], ...controlModel }
    const setModel = vi.spyOn(chatActions, 'setModel')
    render()
    expect(setModel.mock.calls[0]?.[4]?.resolvedModel).toBe('claude-haiku-5-5')
    expect(getActiveChatSession()).toMatchObject({
      modelFamily: 'haiku',
      modelAlias: 'haiku',
      modelResolved: 'claude-haiku-5-5',
      permissionMode: 'auto_classified'
    })
  }
)
it('0304 a model menu click carries evidence through the selection object', () => {
  const fakeWindow = window
  installChatStoreHarness({ sessionId: null, backend: 'claude', agentKind: 'work' })
  const oo = window.oo
  vi.stubGlobal('window', fakeWindow)
  Object.assign(window, { oo })
  catalog.agents = [
    {
      ...agent('claude'),
      models: [
        {
          alias: 'sonnet',
          model: 'claude-sonnet-4-5',
          isCustom: false,
          isDefault: true,
          oneMillionContext: false
        },
        {
          alias: 'haiku',
          model: 'haiku',
          resolvedModel: 'claude-haiku-5-5',
          isCustom: false,
          isDefault: false,
          oneMillionContext: false
        }
      ]
    }
  ]
  const setModel = vi.spyOn(chatActions, 'setModel')
  render()
  dom.click(dom.query('[data-model-label]')!)
  const target = dom
    .queryAll('[role="menuitemradio"]')
    .find((node) => node.textContent.includes('haiku'))!
  expect(target).toBeDefined()
  dom.click(target)
  expect(setModel.mock.calls.find((call) => call[1] === 'haiku')?.[4]?.resolvedModel).toBe(
    'claude-haiku-5-5'
  )
  expect(getActiveChatSession()).toMatchObject({
    modelFamily: 'haiku',
    modelResolved: 'claude-haiku-5-5',
    permissionMode: 'auto_classified'
  })
})

it('0304 the real Claude control opens automatic approval for a resolved alias', () => {
  const fakeWindow = window
  installChatStoreHarness({ sessionId: null, backend: 'claude', agentKind: 'work' })
  const oo = window.oo
  vi.stubGlobal('window', fakeWindow)
  Object.assign(window, { oo })
  catalog.agents = [
    {
      ...agent('claude'),
      models: [
        {
          alias: 'haiku',
          model: 'haiku',
          resolvedModel: 'claude-haiku-5-5',
          isCustom: false,
          isDefault: true,
          oneMillionContext: false
        }
      ]
    }
  ]
  render()
  const mode = dom
    .queryAll('[aria-haspopup="menu"]')
    .find((node) => node.textContent.includes('chat.composer.modes.workAutoLabel'))!
  expect(mode).toBeDefined()
  dom.click(mode)
  expect(
    dom
      .queryAll('[role="menuitemradio"]')
      .some((node) => node.textContent.includes('chat.composer.modes.workAutoLabel'))
  ).toBe(true)
})
