import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  FakeNode,
  type FakeDom
} from '../../../shared/ui/renderHarness.testfixture'
import { useSessionsStore } from '../store/sessionsStore'
import type { SessionListItem } from '../../../../../shared/ipc'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../shared/i18n', async (original) => {
  const actual = await original<typeof import('../../../shared/i18n')>()
  return { ...actual, useI18n: () => ({ tr: actual.i18n.t.bind(actual.i18n) }) }
})
vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  const useStore = <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
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
import { SessionRow } from './SessionRow'
const session: SessionListItem = {
  id: 's',
  backend: 'claude',
  agentKind: 'code',
  title: '대화',
  preview: null,
  cwd: null,
  projectId: null,
  pinnedAt: null,
  updatedAt: 1
}
const initial = useSessionsStore.getInitialState()
const original = { ...initial }
let dom: FakeDom
beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(FakeNode.prototype, 'select', { configurable: true, value: vi.fn() })
  Object.assign(initial, { generatingSessionIds: new Set(['s']), unseenAttention: new Map() })
  useSessionsStore.setState({ generatingSessionIds: new Set(['s']), unseenAttention: new Map() })
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
})
afterEach(() => {
  dom.unmount()
  Reflect.deleteProperty(FakeNode.prototype, 'select')
  Object.assign(initial, original)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const render = (
  variant: 'nav' | 'catalog',
  menu = true
): {
  pin: ReturnType<typeof vi.fn>
  rename: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
} => {
  const pin = vi.fn(),
    rename = vi.fn(),
    remove = vi.fn()
  dom.render(
    createElement(SessionRow, {
      session,
      variant,
      isActive: false,
      appearance: { navIcon: 'terminal2', label: 'chat.agent.code' },
      renameable: menu,
      ...(menu ? { onTogglePin: pin, onRename: rename, onDelete: remove } : {})
    })
  )
  return { pin, rename, remove }
}
it.each(['nav', 'catalog'] as const)(
  '0293 opening the kebab menu hides the status slot until it closes (%s)',
  (variant) => {
    const { pin } = render(variant)
    const before = dom.query('[data-context="session-status"]')!.props['data-state']
    dom.click(dom.query('[aria-label="세션 메뉴"]')!)
    expect(dom.queryAll('[role="menuitem"]')).toHaveLength(3)
    expect(dom.query('[data-context="session-status"]')).toBeNull()
    expect(dom.query('[aria-label="세션 메뉴"]')!.props.className).toContain(' grid')
    dom.key('Escape')
    expect(dom.query('[data-context="session-status"]')!.props['data-state']).toBe(before)
    dom.click(dom.query('[aria-label="세션 메뉴"]')!)
    dom.mouseDown(dom.createNode('button'))
    expect(dom.query('[data-context="session-status"]')!.props['data-state']).toBe(before)
    dom.click(dom.query('[aria-label="세션 메뉴"]')!)
    dom.click(dom.queryAll('[role="menuitem"]')[0])
    expect(pin).toHaveBeenCalledExactlyOnceWith('s', true)
  }
)
it.each(['nav', 'catalog'] as const)(
  '0293 rename keeps the status slot and drops the kebab (%s)',
  (variant) => {
    render(variant)
    dom.click(dom.query('[aria-label="세션 메뉴"]')!)
    dom.click(dom.queryAll('[role="menuitem"]')[1])
    expect(dom.query('[aria-label="세션 제목 편집"]')).not.toBeNull()
    const status = dom.query('[data-context="session-status"]')!
    expect(status.props['data-state']).toBe('in-progress')
    expect(status.props.className).toContain('ml-auto')
    expect(status.props.className).not.toContain('group-hover/')
    expect(dom.query('[aria-label="세션 메뉴"]')).toBeNull()
    expect(dom.query('[data-context="session-agent-kind"]')!.props.className).toBe(
      'inline-flex shrink-0'
    )
  }
)
it('0293 rows without menu items keep the status slot on hover', () => {
  render('nav', false)
  expect(dom.query('[data-context="session-status"]')!.props.className).not.toContain(
    'group-hover/'
  )
  expect(dom.query('[aria-label="세션 메뉴"]')).toBeNull()
})
