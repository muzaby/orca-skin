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
    sessionId: 'session-A' as string | null,
    backend: 'claude',
    agentKind: 'work',
    title: 'Chat',
    cwd: '/repo',
    pendingProjectId: 'draft-project',
    projectId: null,
    worktree: null,
    messages: [],
    rightPanelTiles: [],
    rightPanelTileLabels: {}
  }
}))
vi.mock('../store/chatStore', () => ({
  useChatStore: (select: (s: { activeKey: string; sessions: Record<string, object> }) => unknown) =>
    select({ activeKey: 'fixture', sessions: { fixture: {} } }),
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

it.each(['claude', 'opencode'])(
  'opens the %s tile menu without a native popup or native lookup',
  async (backend) => {
    fixture.state.backend = backend
    fixture.state.agentKind = 'code'
    dom.render(createElement(ChatTitleBar))
    dom.click(dom.query('[aria-label="chat.titleBar.tilesButton"]')!)
    await settle()
    expect(dom.query('[data-native-resources]')).toBeNull()
    expect(dom.query('[role="menu"]')?.textContent).not.toContain('chat.nativeResources.plugins')
    expect(dom.query('[role="menu"]')?.textContent).not.toContain('MCP')
    expect(read).not.toHaveBeenCalled()
  }
)
