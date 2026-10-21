import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { OpenCodeAgentControl, OpenCodeVariantControl } from './Controls'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
const harness = vi.hoisted(() => ({
  selected: { harnessAgent: 'build', modelVariant: 'high' },
  change: vi.fn()
}))
vi.mock('../../../store/chatStore', () => ({
  useChatSession: (selector: (state: typeof harness.selected) => unknown) =>
    selector(harness.selected),
  chatActions: { setHarnessOptions: harness.change }
}))
let dom: FakeDom
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  harness.change.mockClear()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const key = (node: FakeNode, value: string): void => {
  dom.act(() =>
    (node.props.onKeyDown as (event: unknown) => void)({
      key: value,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })
  )
}

describe('OpenCode composer selection', () => {
  it.each(['loading', 'error', 'ready'] as const)(
    'keeps %s internal and offers a fixed keyboard-accessible refresh action',
    (status) => {
      const refresh = vi.fn()
      dom.render(
        createElement(OpenCodeAgentControl, {
          agents: [{ name: 'build' }],
          status,
          onRetry: refresh
        })
      )
      const trigger = dom.query('[aria-label="harness.agent"]')!
      dom.click(trigger)
      dom.advance(20)
      const rows = dom.queryAll('[role="menuitemradio"]')
      expect(rows.map((row) => row.textContent)).toEqual(['harness.defaultAgent', 'build'])
      expect(dom.query('[role="status"]')).toBeNull()
      expect(dom.query('[role="progressbar"]')).toBeNull()
      expect(trigger.props['aria-busy']).toBeUndefined()
      expect(dom.query('[role="menu"]')?.textContent).toBe(
        'harness.agentharness.defaultAgentbuildharness.catalogRefresh'
      )
      key(rows[0].parent!, 'End')
      expect(dom.activeElement?.textContent).toBe('harness.catalogRefresh')
      dom.click(dom.activeElement!)
      expect(refresh).toHaveBeenCalledOnce()
      expect(harness.change).not.toHaveBeenCalled()
      key(rows[0].parent!, 'Escape')
      expect(dom.activeElement).toBe(trigger)
    }
  )
  it('removes a stale agent only after an authoritative runtime catalog and hides missing variants', () => {
    dom.render(createElement(OpenCodeAgentControl, { agents: [{ name: 'plugin-review' }] }))
    expect(harness.change).not.toHaveBeenCalled()
    dom.render(
      createElement(OpenCodeAgentControl, {
        agents: [{ name: 'plugin-review' }],
        authoritative: true
      })
    )
    expect(harness.change).toHaveBeenCalledWith({ agent: '', variant: '' })
    dom.click(dom.query('[aria-label="harness.agent"]')!)
    dom.click(dom.queryAll('[role="menuitemradio"]')[1])
    expect(harness.change).toHaveBeenLastCalledWith({ agent: 'plugin-review' })
    dom.render(createElement(OpenCodeVariantControl, { variants: [] }))
    expect(dom.query('[aria-label="harness.variant"]')).toBeNull()
    expect(harness.change).toHaveBeenLastCalledWith({ agent: 'plugin-review' })
    dom.render(createElement(OpenCodeVariantControl, { variants: [], authoritative: true }))
    expect(harness.change).toHaveBeenLastCalledWith({ variant: '' })
  })
  it('opens at the current agent, navigates with keys and sends the exact agent selection', () => {
    dom.render(
      createElement(OpenCodeAgentControl, { agents: [{ name: 'build' }, { name: 'plan' }] })
    )
    const trigger = dom.query('[aria-label="harness.agent"]')!
    key(trigger, 'ArrowDown')
    dom.advance(20)
    expect(dom.activeElement?.textContent).toBe('build')
    const rows = dom.queryAll('[role="menuitemradio"]')
    expect(rows[1].props['aria-checked']).toBe(true)
    const menu = rows[0].parent!
    key(menu, 'End')
    expect(dom.activeElement?.textContent).toBe('plan')
    key(menu, 'ArrowUp')
    expect(dom.activeElement?.textContent).toBe('build')
    dom.click(rows[2])
    expect(harness.change.mock.calls).toEqual([[{ agent: 'plan' }]])
    expect(dom.query('[role="menu"]')).toBeNull()
    expect(dom.activeElement).toBe(trigger)
  })

  it('passes a variant or the default value and Escape does not change the selection', () => {
    dom.render(createElement(OpenCodeVariantControl, { variants: ['low', 'high'] }))
    const trigger = dom.query('[aria-label="harness.variant"]')!
    dom.click(trigger)
    dom.advance(20)
    expect(dom.activeElement?.textContent).toBe('high')
    const rows = dom.queryAll('[role="menuitemradio"]')
    key(rows[0].parent!, 'Escape')
    expect(harness.change).not.toHaveBeenCalled()
    expect(dom.activeElement).toBe(trigger)
    dom.click(trigger)
    dom.click(dom.queryAll('[role="menuitemradio"]')[1])
    expect(harness.change).toHaveBeenLastCalledWith({ variant: 'low' })
    dom.click(trigger)
    dom.click(dom.queryAll('[role="menuitemradio"]')[0])
    expect(harness.change).toHaveBeenLastCalledWith({ variant: '' })
  })
})
