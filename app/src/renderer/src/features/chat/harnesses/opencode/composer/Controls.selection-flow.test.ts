import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { installChatStoreHarness } from '../../../store/chatStore.testHarness'
import { chatActions, getActiveChatSession } from '../../../store/chatStore'
import { OpenCodeAgentControl, OpenCodeModeControl } from './Controls'
import { composerAgentStore } from './composerAgentStore'
import type {
  ComposerCatalogResult,
  ComposerCatalogRequest
} from '../../../../../../../shared/composer-catalog'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  const { fakeHooks } = await import('../../../../../shared/ui/renderHarness.testfixture')
  const useStore = <T, U>(store: import('zustand').StoreApi<T>, select: (s: T) => U): U =>
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
let dom: FakeDom
let ipc: ReturnType<typeof installChatStoreHarness>
const settle = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve()
    dom.act(() => {})
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  ipc = installChatStoreHarness({
    sessionId: null,
    cwd: 'C:/flow',
    backend: 'opencode',
    providerKey: 'native',
    agentKind: 'code',
    modelFamily: 'model'
  })
  const orca = window.orca
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
  Object.assign(window, { orca })
  Object.assign(window.orca, {
    session: {
      composerCatalog: async (r: ComposerCatalogRequest) => ({
        part: r.part,
        value: [],
        generation: 'g'
      }),
      releaseComposerCatalog: async () => {},
      onComposerCatalogInvalidated: () => () => {}
    }
  })
  composerAgentStore.getState().invalidate(composerAgentStore.getState().revision + 1)
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const trigger = (): import('../../../../../shared/ui/renderHarness.testfixture').FakeNode =>
  dom.query('[aria-label="harness.agent"]')!
it('routes returned first agent through label, check, real store and initial send while models still load', async () => {
  const models = Promise.withResolvers<ComposerCatalogResult>()
  Object.assign(window.orca, {
    session: {
      composerCatalog: (r: ComposerCatalogRequest) =>
        r.part === 'agents'
          ? Promise.resolve({
              part: 'agents',
              value: [{ name: 'z-first' }, { name: 'a-second' }],
              generation: 'g'
            })
          : models.promise,
      releaseComposerCatalog: async () => {},
      onComposerCatalogInvalidated: () => () => {}
    }
  })
  dom.render(
    createElement(OpenCodeModeControl, {
      agents: [],
      providerKey: 'native',
      modelFamily: 'model',
      model: null
    })
  )
  await settle()
  expect(getActiveChatSession().harnessAgent).toBe('z-first')
  expect(trigger().textContent).toBe('z-first')
  dom.click(trigger())
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.props['aria-checked'])).toEqual([
    true,
    false
  ])
  expect(dom.query('[data-agent-loading]')).toBeNull()
  expect(chatActions.send('first')).toBe(true)
  expect(ipc.chatSend.mock.calls[0][0].harnessAgent).toBe('z-first')
})
it('keeps manual selection, falls back on removal, clears empty results and sends on an existing session', () => {
  const agents = [{ name: 'z-first' }, { name: 'a-second' }]
  const render = (list = agents, status: 'loading' | 'ready' | 'error' = 'ready'): void =>
    dom.render(createElement(OpenCodeAgentControl, { agents: list, authoritative: true, status }))
  render()
  dom.click(trigger())
  dom.click(dom.queryAll('[role="menuitemradio"]')[1])
  render()
  expect(trigger().textContent).toBe('a-second')
  chatActions.setHarnessOptions({ variant: 'deep' })
  render([], 'loading')
  expect(getActiveChatSession().harnessAgent).toBe('a-second')
  render([], 'error')
  expect(trigger().textContent).toBe('a-second')
  render([{ name: 'z-first' }])
  expect(getActiveChatSession()).toMatchObject({ harnessAgent: 'z-first', modelVariant: '' })
  render([])
  expect(getActiveChatSession().harnessAgent).toBe('')
  expect(trigger().textContent).toBe('harness.noAgents')
  dom.unmount()
  ipc = installChatStoreHarness({
    sessionId: 'existing',
    backend: 'opencode',
    agentKind: 'code',
    harnessAgent: 'a-second'
  })
  const orca = window.orca
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
  Object.assign(window, { orca })
  render()
  expect(chatActions.send('next')).toBe(true)
  expect(ipc.chatSend.mock.calls[0][0]).toMatchObject({
    sessionId: 'existing',
    harnessAgent: 'a-second'
  })
})
it.each(['loading', 'error', 'ready'] as const)(
  'displays an explicit %s state without a generic agent trigger',
  (status) => {
    dom.render(createElement(OpenCodeAgentControl, { agents: [], authoritative: true, status }))
    expect(trigger().textContent).toBe(
      `harness.${status === 'loading' ? 'agentLoading' : status === 'error' ? 'agentError' : 'noAgents'}`
    )
  }
)
