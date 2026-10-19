import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useDeferredValue: <T>(value: T): T => value
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
const fixture = vi.hoisted(() => ({
  sessionId: 'session-B',
  backend: 'claude' as 'claude' | 'opencode',
  agentKind: 'code' as const
}))
vi.mock('../../../store/chatStore', () => ({
  useChatSession: (select: (value: typeof fixture) => unknown) => select(fixture)
}))
vi.mock('../../../../../shared/i18n', () => {
  const tr = (key: string): string => key
  return { useI18n: () => ({ tr }) }
})
vi.mock('./ComposerInputSurface', async () => {
  const { createElement } = await import('react')
  return {
    ComposerInputSurface: ({ snapshot }: { snapshot: { text: string } }) =>
      createElement('textarea', { 'data-native-draft': true, value: snapshot.text })
  }
})
import { createElement } from 'react'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { composerHarness } from '../../registries/composer'
import { ComposerInputController } from './ComposerInputController'
let dom: FakeDom
const read = vi.fn()
const onSend = vi.fn(() => true)
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
  read.mockReset().mockImplementation(async (id: string) => ({
    state: 'connected',
    items: [],
    commands: [
      {
        name: `${id}:review`,
        source: 'plugin',
        description: 'Review current code',
        argumentHint: ''
      }
    ]
  }))
  onSend.mockClear()
  fixture.sessionId = 'session-B'
  Object.assign(window, {
    orca: {
      session: { nativeResources: read },
      skills: { list: async () => [] },
      provider: { state: async () => ({ providers: [] }), onState: () => () => {} }
    }
  })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  dom.act(() => {})
}
function render(): void {
  dom.render(
    createElement(ComposerInputController, {
      presentation: composerHarness(fixture.backend),
      active: true,
      backendLabel: fixture.backend,
      canAbort: true,
      inflight: false,
      steerBlocked: false,
      toolApprovalPending: false,
      cwd: null,
      initialDraft: 'preserved draft',
      onSend,
      onCancel: () => {},
      controlsStart: null,
      controlsEnd: null,
      diffRequirementSnapshot: {
        sessionKey: fixture.sessionId,
        sessionId: fixture.sessionId,
        ids: [],
        revision: 0,
        anchors: []
      },
      onClearDiffRequirementsIfUnchanged: () => {}
    })
  )
}
function clickLabel(label: string): void {
  const button = dom
    .queryAll('[role="menuitem"]')
    .find((item) => item.textContent.startsWith(label))
  expect(button, label).toBeDefined()
  dom.click(button!)
}
it.each(['claude', 'opencode'] as const)(
  'loads %s native commands from +, inserts without sending and reloads on reentry',
  async (backend) => {
    fixture.backend = backend
    render()
    await settle()
    expect(read).toHaveBeenCalledExactlyOnceWith('session-B')
    const open = (): void => dom.click(dom.query('[title="chat.composer.attachMenuTitle"]')!)
    open()
    await settle()
    expect(read).toHaveBeenCalledWith('session-B')
    clickLabel('chat.composer.attachMenu.plugins')
    clickLabel(backend === 'claude' ? 'Claude' : 'OpenCode')
    clickLabel('chat.nativeResources.plugins')
    clickLabel('/session-B:review')
    await settle()
    expect(dom.query('[data-native-draft]')!.props.value).toBe('/session-B:review preserved draft')
    expect(onSend).not.toHaveBeenCalled()
    fixture.sessionId = 'session-C'
    render()
    await settle()
    expect(read).toHaveBeenCalledWith('session-C')
    fixture.sessionId = 'session-B'
    render()
    await settle()
    open()
    await settle()
    expect(read.mock.calls.filter(([id]) => id === 'session-B')).toHaveLength(4)
    clickLabel('chat.composer.attachMenu.plugins')
    clickLabel(backend === 'claude' ? 'Claude' : 'OpenCode')
    let finishRefresh!: (value: unknown) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve
        })
    )
    clickLabel('chat.nativeResources.refresh')
    await settle()
    expect(read.mock.calls.filter(([id]) => id === 'session-B')).toHaveLength(5)
    expect(dom.query('[title="chat.composer.attachMenuTitle"]')!.props['aria-expanded']).toBe(true)
    expect(
      dom
        .queryAll('[role="menu"]')
        .some((menu) => menu.textContent.includes('chat.nativeResources.refreshing'))
    ).toBe(true)
    clickLabel('chat.nativeResources.plugins')
    expect(
      dom
        .queryAll('[role="menuitem"]')
        .some((item) => item.textContent.startsWith('/session-B:review'))
    ).toBe(true)
    finishRefresh({ state: 'connected', items: [], commands: [] })
    await settle()
    expect(
      dom
        .queryAll('[role="menuitem"]')
        .some((item) => item.textContent.startsWith('/session-B:review'))
    ).toBe(false)
  }
)
