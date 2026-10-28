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

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
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
function render(): void {
  dom.render(
    createElement(
      Fragment,
      null,
      createElement(composerModule.ModeControl, props),
      createElement(composerModule.EffortControl, props)
    )
  )
}
async function settle(): Promise<void> {
  for (let n = 0; n < 20; n++) await Promise.resolve()
  dom.act(() => {})
}
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
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
        onManagedMcpChanged: (callback: () => void) => {
          managedChanged = callback
          return () => {}
        }
      },
      settings: { set: async () => ({}) }
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
  'does not inherit a promoted model snapshot after a %s mismatch',
  async (_label, patch, before) => {
    seed(before)
    render()
    await settle()
    dom.act(() => ingestChatEvent({ type: 'session.updated', sessionId: 'mismatch', patch }))
    await settle()
    dom.click(dom.query('[aria-label="harness.variant"]')!)
    expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).not.toContain(
      'deep'
    )
    saved.resolve({
      part: 'models',
      generation: 'new-target',
      value: [{ id: 'distinct/model', variants: ['fresh'] }]
    })
    await settle()
    expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toContain('fresh')
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
