import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'fixture-id'
}))
vi.mock(
  'react-dom',
  async () => (await import('../shared/ui/renderHarness.testfixture')).fakeReactDom
)
const route = vi.hoisted(() => ({
  pathname: '/chat/s',
  navigate: vi.fn(),
  collapsed: false,
  width: 248
}))
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: route.pathname }),
  useNavigate: () => route.navigate
}))
vi.mock('../shared/theme', () => ({
  useTweakContext: () => ({
    t: { sidebarCollapsed: route.collapsed, sidebarWidth: route.width },
    setTweak: vi.fn()
  })
}))
vi.mock('../shared/hooks/useDragResize', () => ({
  useDragResize: () => ({ startResize: vi.fn() })
}))
vi.mock('../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../features/chat', async () => ({
  chatActions: (await import('../features/chat/store/chatStore')).chatActions,
  HarnessLogo: (await import('../features/chat/harnesses/registries/brand')).HarnessLogo
}))
import { createElement } from 'react'
import { Sidebar } from './Sidebar'
import { installFakeDom, type FakeDom } from '../shared/ui/renderHarness.testfixture'
import { installChatStoreHarness } from '../features/chat/store/chatStore.testHarness'
import {
  chatActions,
  getActiveChatSession,
  seedLandingBackend,
  useChatStore
} from '../features/chat/store/chatStore'

let dom: FakeDom
function render(collapsed = false): {
  harness: ReturnType<typeof installChatStoreHarness>
  trigger: import('../shared/ui/renderHarness.testfixture').FakeNode
} {
  route.collapsed = collapsed
  const harness = installChatStoreHarness({ backend: 'claude', title: 'keep existing' })
  const orca = window.orca
  dom = installFakeDom({
    innerWidth: 1200,
    innerHeight: 800,
    layout: (node) => {
      if (node.tag === 'aside')
        return { rect: { left: 8, top: 8, width: route.collapsed ? 56 : route.width, height: 700 } }
      if (node.props['aria-haspopup'] === 'menu')
        return { rect: { left: 15, top: 60, width: route.collapsed ? 42 : 234, height: 30 } }
      if (node.props['data-context'] === 'floating')
        return { rect: { left: 0, top: 0, width: 184, height: 72 } }
      return undefined
    }
  })
  Object.assign(window, { orca })
  dom.render(
    createElement(Sidebar, {
      projectsSlot: null,
      pinnedSlot: null,
      sessionsSlot: null,
      footerSlot: null
    })
  )
  const trigger = dom
    .queryAll('[onClick]')
    .find(
      (node) =>
        node.props['aria-label'] === 'sidebar.nav.newChat' ||
        node.textContent === 'sidebar.nav.newChat'
    )!
  return { harness, trigger }
}
beforeEach(() => {
  vi.useFakeTimers()
  route.navigate.mockClear()
  route.pathname = '/chat/s'
  seedLandingBackend(null)
})
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('new chat direct entry', () => {
  it.each([false, true])(
    'navigates straight to the landing from expanded and collapsed nav (%s)',
    (collapsed) => {
      const { trigger } = render(collapsed)
      const before = useChatStore.getState()
      dom.click(trigger)
      expect(route.navigate).toHaveBeenCalledExactlyOnceWith('/new')
      expect(dom.queryAll('[role="menu"]')).toHaveLength(0)
      expect(trigger.props['aria-haspopup']).toBeUndefined()
      expect(trigger.props['aria-expanded']).toBeUndefined()
      expect(useChatStore.getState()).toBe(before)
    }
  )
  it('keeps the draft when already on the landing', () => {
    route.pathname = '/new'
    const { trigger } = render()
    const reset = vi.spyOn(chatActions, 'newChat')
    const before = useChatStore.getState()
    dom.click(trigger)
    expect(reset).not.toHaveBeenCalled()
    expect(useChatStore.getState()).toBe(before)
    reset.mockRestore()
  })
  it('seeds the next landing with the last harness', () => {
    render()
    seedLandingBackend('opencode')
    chatActions.newChat()
    expect(getActiveChatSession().backend).toBe('opencode')
  })
})
