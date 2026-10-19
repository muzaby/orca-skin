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
