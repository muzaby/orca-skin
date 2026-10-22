import { createElement, Fragment } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ComposerControlProps } from '../../contracts'
import type {
  ComposerCatalogRequest,
  ComposerCatalogResult
} from '../../../../../../../shared/composer-catalog'
import { composerModule } from './Module'
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
