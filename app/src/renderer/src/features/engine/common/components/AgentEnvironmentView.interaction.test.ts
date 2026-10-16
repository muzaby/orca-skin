import { createElement, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeNode } from '../../../../shared/ui/renderHarness.testfixture'
import { AgentEnvironmentView } from '../../components/AgentEnvironmentView'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../../shared/ui/Modal', () => ({
  Modal: ({ children }: { children: ReactNode }) => children
}))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('react-i18next', () => ({ Trans: () => null }))
vi.mock('../hooks/useEngines', () => ({
  useEngines: () => ({
    agents: [],
    state: { busy: false, error: null },
    refresh: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    read: vi.fn()
  })
}))
const nodes = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(nodes)]
let cleanup = (): void => {}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('selects Claude or OpenCode before opening their production forms and closes the menu', () => {
  vi.useFakeTimers()
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  cleanup = () => dom.unmount()
  dom.render(createElement(AgentEnvironmentView))
  const button = (text: string): FakeNode =>
    nodes(dom.body).find((node) => node.tag === 'button' && node.textContent === text)!
  const add = button('engine.addEngine')
  expect(add.props['aria-expanded']).toBe(false)
  dom.click(add)
  expect(button('Claude Code')).toBeDefined()
  expect(button('OpenCode')).toBeDefined()
  dom.click(button('OpenCode'))
  expect(dom.body.textContent).toContain('engine.openCode.title')
  expect(nodes(dom.body).filter((node) => node.props.role === 'menuitem')).toHaveLength(0)
  dom.click(button('common.cancel'))
  dom.click(button('engine.addEngine'))
  dom.click(button('Claude Code'))
  expect(dom.body.textContent).toContain('engine.form.importButton')
  expect(dom.body.textContent).not.toContain('engine.openCode.title')
  expect(nodes(dom.body).filter((node) => node.tag === 'select')).toHaveLength(0)
})
