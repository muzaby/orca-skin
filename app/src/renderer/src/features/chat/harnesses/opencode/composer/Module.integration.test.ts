import { composerAgentStore } from './composerAgentStore'
import { createElement, Fragment } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ComposerControlProps } from '../../contracts'
import type {
  ComposerCatalogRequest,
  ComposerCatalogResult
} from '../../../../../../../shared/composer-catalog'
import { composerModule } from './Module'
const pluginEvents = vi.hoisted(() => {
  const subscribe = vi.fn<(handler: (event: { revision: number }) => void) => () => void>(() =>
    vi.fn()
  )
  vi.stubGlobal('window', { orca: { session: { onOpenCodePluginsChanged: subscribe } } })
  return { subscribe }
})
// Bind the real vanilla store to the test React runtime.
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../../../shared/ui/renderHarness.testfixture')
  return {
    ...actual,
    useStore: <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
      fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())) as U
  }
})
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
const state = vi.hoisted(() => ({
  selected: {
    sessionId: null,
    cwd: 'C:/plugin-project',
    projectId: 'project-B',
    pendingProjectId: null,
    agentKind: 'code',
    harnessAgent: 'plugin-review',
    modelVariant: 'deep'
  },
  change: vi.fn()
}))
vi.mock('../../../store/chatStore', () => ({
  useChatSession: (selector: (value: typeof state.selected) => unknown) => selector(state.selected),
  chatActions: { setHarnessOptions: state.change }
}))
let dom: FakeDom
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  state.change.mockClear()
  composerAgentStore.getState().invalidate(composerAgentStore.getState().revision + 1)
})
afterEach(async () => {
  dom.unmount()
  await vi.runOnlyPendingTimersAsync()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const settle = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
  dom.act(() => undefined)
}

it('prepares draft agents before providers, reuses cached agents and variants across menu reopenings', async () => {
  const models = Promise.withResolvers<ComposerCatalogResult>()
  let names = [{ name: 'plugin-review' }]
  const query = vi.fn(async (request: ComposerCatalogRequest): Promise<ComposerCatalogResult> =>
    request.part === 'agents' ? { part: 'agents', value: names, generation: 'g1' } : models.promise
  )
  const release = vi.fn(async () => undefined)
  Object.assign(window, {
    orca: {
      session: {
        composerCatalog: query,
        releaseComposerCatalog: release,
        onComposerCatalogInvalidated: () => () => undefined
      }
    }
  })
  const model = {
    alias: 'custom',
    model: 'plugin/model',
    isCustom: true,
    isDefault: true,
    oneMillionContext: false
  }
  const props: ComposerControlProps = {
    agents: [
      {
        key: 'native',
        adapter: 'opencode',
        supported: true,
        models: [model],
        agents: [{ name: 'static-agent' }]
      }
    ],
    providerKey: 'native',
    modelFamily: 'plugin/model',
    model
  }
  const render = (): void =>
    dom.render(
      createElement(
        Fragment,
        null,
        createElement(composerModule.ModeControl, props),
        createElement(composerModule.EffortControl, props)
      )
    )
  render()
  expect(dom.query('[aria-label="harness.agent"]')?.props['aria-busy']).toBeUndefined()
  await settle()
  expect(query).toHaveBeenCalledTimes(2)
  expect(query.mock.calls[0][0].scope).toEqual({
    backend: 'opencode',
    sessionId: null,
    cwd: 'C:/plugin-project',
    projectId: 'project-B',
    providerKey: 'native',
    agentKind: 'code'
  })
  dom.click(dom.query('[aria-label="harness.agent"]')!)
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual([
    'plugin-review'
  ])
  expect(dom.query('[data-agent-loading]')).toBeNull()
  expect(dom.query('[role="group"]')?.props['aria-busy']).toBe(false)
  expect(dom.query('[aria-label="harness.variant"]')?.props['aria-busy']).toBeUndefined()
  dom.click(dom.queryAll('[role="menuitemradio"]')[0])
  expect(state.change).toHaveBeenCalledWith({ agent: 'plugin-review' })
  dom.unmount()
  render()
  await settle()
  expect(query).toHaveBeenCalledTimes(2)
  expect(release).not.toHaveBeenCalled()
  models.resolve({
    part: 'models',
    value: [{ id: 'plugin/model', variants: ['deep'] }],
    generation: 'g1'
  })
  await settle()
  expect(dom.query('[aria-label="harness.variant"]')?.textContent).toContain('deep')
  names = [{ name: 'plugin-revised' }]
  for (const label of ['harness.agent', 'harness.variant']) {
    for (let i = 0; i < 3; i++) {
      dom.click(dom.query(`[aria-label="${label}"]`)!)
      expect(dom.query('[role="menuitem"]')).toBeNull()
      expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual(
        label === 'harness.agent' ? ['plugin-review'] : ['harness.defaultVariant', 'deep']
      )
      dom.click(dom.queryAll('[role="menuitemradio"]')[label === 'harness.agent' ? 0 : 1])
      await settle()
    }
  }
  expect(query).toHaveBeenCalledTimes(2)
  expect(state.change).not.toHaveBeenCalledWith({ agent: '', variant: '' })
})

it.each(['agents', 'models'] as const)(
  'uses only the agent slot for title loading when %s completes first',
  async (first) => {
    const agents = Promise.withResolvers<ComposerCatalogResult>()
    const models = Promise.withResolvers<ComposerCatalogResult>()
    const query = vi.fn((request: ComposerCatalogRequest) =>
      request.part === 'agents' ? agents.promise : models.promise
    )
    Object.assign(window, {
      orca: {
        session: {
          composerCatalog: query,
          releaseComposerCatalog: vi.fn(async () => undefined),
          onComposerCatalogInvalidated: () => () => undefined
        }
      }
    })
    const props: ComposerControlProps = {
      agents: [],
      providerKey: 'native',
      modelFamily: '',
      model: null
    }
    dom.render(createElement(composerModule.ModeControl, props))
    await settle()
    dom.click(dom.query('[aria-label="harness.agent"]')!)
    expect(dom.query('[data-agent-loading]')).not.toBeNull()
    const agentResult: ComposerCatalogResult = {
      part: 'agents',
      value: [{ name: 'plugin-review' }],
      generation: 'g1'
    }
    const modelResult: ComposerCatalogResult = {
      part: 'models',
      value: [{ id: 'model-B', variants: ['deep'] }],
      generation: 'g1'
    }
    if (first === 'agents') agents.resolve(agentResult)
    else models.resolve(modelResult)
    await settle()
    expect(dom.query('[data-agent-loading]') !== null).toBe(first !== 'agents')
    expect(dom.query('[role="group"]')?.props['aria-busy']).toBe(first !== 'agents')
    expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual(
      first === 'agents' ? ['plugin-review'] : []
    )
    if (first === 'agents') models.resolve(modelResult)
    else agents.resolve(agentResult)
    await settle()
    expect(dom.query('[data-agent-loading]')).toBeNull()
    expect(dom.query('[role="group"]')?.props['aria-busy']).toBe(false)
    expect(query).toHaveBeenCalledTimes(2)
    expect(state.change).not.toHaveBeenCalled()
  }
)

it('reuses the first successful agent list across landing scopes without requesting or spinning', async () => {
  const query = vi.fn(
    async (request: ComposerCatalogRequest): Promise<ComposerCatalogResult> =>
      ({
        part: request.part,
        value:
          request.part === 'agents'
            ? [{ name: request.scope.cwd === 'C:/A' ? 'first' : 'wrong' }]
            : [],
        generation: request.scope.cwd ?? 'none'
      }) as ComposerCatalogResult
  )
  Object.assign(window, {
    orca: {
      session: {
        composerCatalog: query,
        releaseComposerCatalog: async () => {},
        onComposerCatalogInvalidated: () => () => {}
      }
    }
  })
  const props = {
    agents: [],
    providerKey: 'team',
    modelFamily: null,
    model: null
  } as unknown as ComposerControlProps
  state.selected.cwd = 'C:/A'
  dom.render(createElement(composerModule.ModeControl, props))
  await settle()
  dom.unmount()
  await vi.runOnlyPendingTimersAsync()
  state.selected.cwd = 'C:/B'
  dom.render(createElement(composerModule.ModeControl, { ...props, providerKey: 'other' }))
  dom.click(dom.query('[aria-label="harness.agent"]')!)
  expect(dom.query('[data-agent-loading]')).toBeNull()
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual(['first'])
  await settle()
  expect(query.mock.calls.filter(([r]) => r.part === 'agents')).toHaveLength(1)
})

it('shows cached agents before the chat scope exists', () => {
  composerAgentStore
    .getState()
    .accept([{ name: 'cached-unscoped' }], composerAgentStore.getState().revision)
  Object.assign(state.selected, {
    sessionId: null,
    cwd: null,
    projectId: null,
    pendingProjectId: null
  })
  const query = vi.fn()
  Object.assign(window, { orca: { session: { composerCatalog: query } } })
  const props = {
    agents: [],
    providerKey: null,
    modelFamily: null,
    model: null
  } as unknown as ComposerControlProps
  dom.render(createElement(composerModule.ModeControl, props))
  dom.click(dom.query('[aria-label="harness.agent"]')!)
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual([
    'cached-unscoped'
  ])
  expect(dom.query('[data-agent-loading]')).toBeNull()
  expect(query).not.toHaveBeenCalled()
})

it('clears cached agents on plugin changes with no Composer mounted and refetches on remount', async () => {
  const revision = composerAgentStore.getState().revision
  composerAgentStore.getState().accept([{ name: 'old-global' }], revision)
  expect(pluginEvents.subscribe).toHaveBeenCalledTimes(1)
  pluginEvents.subscribe.mock.calls[0][0]({ revision: revision + 1 })
  expect(composerAgentStore.getState().agents).toBeUndefined()
  const query = vi.fn(
    async (request: ComposerCatalogRequest): Promise<ComposerCatalogResult> =>
      ({
        part: request.part,
        value: request.part === 'agents' ? [{ name: 'new-global' }] : [],
        generation: 'g2'
      }) as ComposerCatalogResult
  )
  Object.assign(state.selected, {
    sessionId: null,
    cwd: 'C:/no-view',
    projectId: 'no-view',
    pendingProjectId: null
  })
  Object.assign(window, {
    orca: {
      session: {
        composerCatalog: query,
        releaseComposerCatalog: async () => {},
        onComposerCatalogInvalidated: () => () => {}
      }
    }
  })
  dom.render(
    createElement(composerModule.ModeControl, {
      agents: [],
      providerKey: 'native',
      modelFamily: '',
      model: null
    })
  )
  await settle()
  dom.click(dom.query('[aria-label="harness.agent"]')!)
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual([
    'new-global'
  ])
  expect(query.mock.calls.filter(([r]) => r.part === 'agents')).toHaveLength(1)
})
