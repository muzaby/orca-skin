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
      ModeControl: () => null,
      EffortControl: () => null,
      Chip: ({ label, onClick }: { label: string; onClick: () => void }) =>
        createElement('button', { 'data-model-label': true, onClick }, label)
    })
  }
})
vi.mock('../harnesses/common/composer/ComposerInputController', () => ({
  ComposerInputController: ({ controlsEnd }: { controlsEnd: import('react').ReactNode }) =>
    controlsEnd
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
  const orca = window.orca
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  Object.assign(window, { orca })
  catalog.agents = [agent('claude')]
})
afterEach(() => {
  dom.unmount()
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
  Object.assign(window.orca, {
    session: {
      load: async (id: string) => saved(id),
      refresh: async () => ({ status: 'unchanged' })
    }
  })
  Object.assign(window.orca.chat, {
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
