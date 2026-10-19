import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'fixture-id'
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../shared/i18n', () => {
  const tr = (key: string): string => key
  return { useI18n: () => ({ tr }) }
})
vi.mock('./CwdButton', () => ({ CwdButton: () => null }))
const fixture = vi.hoisted(() => ({
  state: {
    sessionId: 'session-A',
    backend: 'claude',
    agentKind: 'work',
    title: 'Chat',
    cwd: '/repo',
    worktree: null,
    messages: [],
    rightPanelTiles: [],
    rightPanelTileLabels: {}
  }
}))
vi.mock('../store/chatStore', () => ({
  chatActions: { toggleRightPanelTile: vi.fn() },
  getActiveChatSession: () => fixture.state,
  useChatSession: (select: (state: typeof fixture.state) => unknown) => select(fixture.state),
  useUnseenSettledTaskCount: () => 0
}))
import { createElement } from 'react'
import { ChatTitleBar } from './ChatTitleBar'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import type { NativeResources } from '../../../../../shared/native-resources'
let dom: FakeDom
const read = vi.fn<(sessionId: string) => Promise<NativeResources>>()
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  dom.act(() => {})
}
beforeEach(() => {
  vi.useFakeTimers()
  fixture.state.sessionId = 'session-A'
  fixture.state.backend = 'claude'
  read.mockReset().mockResolvedValue({ state: 'connected', generation: 'g', items: [] })
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  Object.assign(window, { orca: { session: { nativeResources: read } } })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('loads native resources only while the actual titlebar popup is mounted and uses the current session', async () => {
  dom.render(createElement(ChatTitleBar))
  await settle()
  expect(read).not.toHaveBeenCalled()
  const trigger = dom.query('[aria-label="chat.titleBar.tilesButton"]')!
  dom.click(trigger)
  await settle()
  expect(read).toHaveBeenCalledExactlyOnceWith('session-A')
  expect(dom.query('[data-native-resources="claude"]')).not.toBeNull()
  dom.click(trigger)
  expect(dom.query('[data-native-resources]')).toBeNull()
  fixture.state.sessionId = 'session-B'
  fixture.state.backend = 'opencode'
  dom.render(createElement(ChatTitleBar))
  dom.click(trigger)
  await settle()
  expect(read).toHaveBeenLastCalledWith('session-B')
  expect(dom.query('[data-native-resources="opencode"]')).not.toBeNull()
})

it('replaces the native menu on session change and ignores the previous session response', async () => {
  let finish!: (value: NativeResources) => void
  read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  dom.render(createElement(ChatTitleBar))
  dom.click(dom.query('[aria-label="chat.titleBar.tilesButton"]')!)
  await settle()
  fixture.state.sessionId = 'session-B'
  fixture.state.backend = 'opencode'
  dom.render(createElement(ChatTitleBar))
  await settle()
  finish({ state: 'disconnected', items: [] })
  await settle()
  const section = dom.query('[data-native-resources="opencode"]')!
  expect(section.textContent).toContain('chat.nativeResources.connected')
  expect(section.textContent).not.toContain('chat.nativeResources.disconnected')
  expect(read.mock.calls).toEqual([['session-A'], ['session-B']])
})
