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

it('prepares draft agents before providers, reuses remounts and applies explicit refresh', async () => {
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
    'harness.defaultAgent',
    'plugin-review'
  ])
  expect(dom.query('[aria-label="harness.variant"]')?.props['aria-busy']).toBeUndefined()
  dom.click(dom.queryAll('[role="menuitemradio"]')[1])
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
  dom.click(dom.query('[aria-label="harness.agent"]')!)
  dom.click(dom.query('[role="menuitem"]')!)
  await settle()
  expect(state.change).toHaveBeenCalledWith({ agent: '', variant: '' })
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual([
    'harness.defaultAgent',
    'plugin-revised'
  ])
  expect(query.mock.calls.filter(([r]) => r.part === 'models')).toHaveLength(1)
})
