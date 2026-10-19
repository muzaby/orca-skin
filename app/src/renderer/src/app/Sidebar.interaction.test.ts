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
  return { harness, trigger: dom.query('[aria-haspopup="menu"]')! }
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

describe('new chat harness entry', () => {
  it.each([false, true])(
    'opens the branded menu flush to the %s collapsed nav without changing the chat',
    (collapsed) => {
      const { trigger } = render(collapsed)
      const before = useChatStore.getState()
      dom.click(trigger)
      dom.frame()
      expect(useChatStore.getState()).toBe(before)
      expect(route.navigate).not.toHaveBeenCalled()
      expect(dom.queryAll('[data-harness-choice]').map((node) => node.textContent)).toEqual([
        'Claude',
        'OpenCode'
      ])
      for (const brand of ['claude', 'opencode'])
        expect(dom.query(`[data-harness-brand="${brand}"]`)?.children[0].tag).toBe('svg')
      expect(dom.query('[data-context="floating"]')?.props.style).toEqual({
        left: collapsed ? 64 : 256,
        top: 60
      })
      expect(dom.activeElement.props['data-harness-choice']).toBe('claude')
      dom.keyDown('ArrowDown')
      expect(dom.activeElement.props['data-harness-choice']).toBe('opencode')
      dom.keyDown('Escape')
      expect(dom.query('[data-context="floating"]')).toBeNull()
      expect(dom.activeElement).toBe(trigger)
      expect(useChatStore.getState()).toBe(before)
      dom.click(trigger)
      dom.click(dom.createNode('button', { id: 'outside' }))
      expect(dom.query('[data-context="floating"]')).toBeNull()
      expect(useChatStore.getState()).toBe(before)
    }
  )
  it.each(['claude', 'opencode'] as const)(
    'selects %s into a fresh draft and preserves the existing session, also on /new',
    (backend) => {
      const { trigger, harness } = render()
      const saved = useChatStore.getState().sessions.s
      for (const path of ['/chat/s', '/new']) {
        route.pathname = path
        dom.click(trigger)
        dom.click(dom.query(`[data-harness-choice="${backend}"]`)!)
        expect(getActiveChatSession()).toMatchObject({
          backend,
          harnessExplicitlySelected: true,
          sessionId: null,
          messages: []
        })
        expect(useChatStore.getState().sessions.s).toBe(saved)
        expect(harness.settingsSet).toHaveBeenLastCalledWith({ lastBackend: backend })
        expect(route.navigate).toHaveBeenLastCalledWith('/new')
        expect(dom.query('[data-context="floating"]')).toBeNull()
      }
    }
  )
})
