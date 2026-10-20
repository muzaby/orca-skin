import { createElement, Fragment } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { nativeResourceState } from '../../../lib/nativeResourceState'
import type { ComposerControlProps } from '../../contracts'
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
  selected: { sessionId: 'plugin-session', harnessAgent: 'plugin-review', modelVariant: 'deep' },
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
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('uses a session runtime catalog in both Composer controls and preserves it across unmount', () => {
  const resources = nativeResourceState(
    JSON.stringify(['opencode', 'plugin-session', null]),
    'plugin-session'
  )
  resources.accept({
    state: 'connected',
    generation: 'g1',
    items: [],
    composer: {
      agents: [{ name: 'plugin-review' }],
      models: [{ id: 'plugin/model', variants: ['deep'] }]
    }
  })
  const model = {
    alias: 'custom',
    model: 'plugin/model',
    isCustom: true,
    isDefault: true,
    oneMillionContext: false,
    variants: ['static-variant']
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
        createElement(composerModule.ModeControl!, props),
        createElement(composerModule.EffortControl!, props)
      )
    )
  render()
  expect(dom.query('[aria-label="harness.agent"]')?.textContent).toContain('plugin-review')
  expect(dom.query('[aria-label="harness.variant"]')?.textContent).toContain('deep')
  dom.unmount()
  render()
  expect(dom.query('[aria-label="harness.agent"]')?.textContent).toContain('plugin-review')
  dom.act(() =>
    resources.accept({
      state: 'connected',
      generation: 'g1',
      items: [],
      composer: {
        agents: [{ name: 'plugin-revised' }],
        models: [{ id: 'plugin/model', variants: [] }]
      }
    })
  )
  expect(dom.query('[aria-label="harness.variant"]')).toBeNull()
  expect(state.change).toHaveBeenCalledWith({ agent: '', variant: '' })
  dom.click(dom.query('[aria-label="harness.agent"]')!)
  expect(dom.queryAll('[role="menuitemradio"]').map((row) => row.textContent)).toEqual([
    'harness.defaultAgent',
    'plugin-revised'
  ])
})
