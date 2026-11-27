import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'
import { useChatStore } from '../store/chatStore'
import { installChatStoreHarness } from '../store/chatStore.testHarness'
import { newTranscriptChanges, recordChange } from '../lib/transcript/changeLog'
import { ChatTile } from './ChatTile'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'transcript-test-id'
}))
vi.mock('zustand', async (original) => {
  const { createFakeZustand } = await import('./transcript/viewportTestBridge.testfixture')
  return createFakeZustand(original)
})
vi.mock('zustand/react/shallow', () => ({
  useShallow: <T, U>(select: (state: T) => U) => select
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } =
    await import('./transcript/viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})
vi.mock('../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key })
}))

// Browser scrolling is orthogonal to the store → ChatTile → timeline path.
vi.mock('./transcript/HarnessScrollController', () => ({
  HarnessScrollController: ({ children }: { children: (scroll: unknown) => unknown }) =>
    children({
      scrollRef: { current: null },
      contentRef: { current: null },
      onScroll: () => {},
      anchored: false,
      isPinned: () => false
    })
}))
vi.mock('./ChatTitleBar', () => ({ ChatTitleBar: () => null }))
vi.mock('./transcript/LineageBanner', () => ({ LineageBanner: () => null }))
vi.mock('./Composer', () => ({ Composer: () => null }))
vi.mock('./rightpanel/RightPanel', () => ({ RightPanel: () => null }))

let dom: FakeDom
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
})
it.each([
  ['claude', 'code'],
  ['claude', 'work'],
  ['opencode', 'code']
] as const)(
  'transcript root names the session that rendered its rows (%s %s)',
  (backend, agentKind) => {
    installChatStoreHarness({
      backend,
      agentKind,
      sessionId: 'sA',
      messages: [
        {
          id: 'native-5',
          role: 'user',
          createdAt: 1,
          parts: [{ type: 'text', text: 'fixture message 5' }]
        }
      ]
    })
    const a = useChatStore.getState().sessions.s
    const b = {
      ...a,
      session: {
        ...a.session,
        sessionId: 'sB',
        transcriptChanges: newTranscriptChanges(),
        messages: [],
        loadingSession: true
      }
    }
    useChatStore.setState({ activeKey: 'sA', sessions: { sA: a, sB: b } })
    dom = installFakeDom({
      innerWidth: 1200,
      innerHeight: 900,
      layout: () => ({ rect: { top: 0, left: 0, width: 600, height: 400 } })
    })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      }
    )
    Object.assign(document, { fonts: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
    dom.render(createElement(ChatTile, { canAbort: false, backendLabel: backend }))
    const root = (): FakeNode | null => dom.query('[data-behavior="virtualizable"]')
    const check = (id: string, text: boolean): void => {
      expect(root()?.getAttribute('data-transcript-session')).toBe(id)
      expect(Boolean(dom.query('[data-message-id="native-5"]'))).toBe(text)
      expect(root()?.textContent.includes('fixture message 5')).toBe(text)
    }
    check('sA', true)
    // A pending navigation slot can have a different key from its session ID.
    dom.act(() =>
      useChatStore.setState({ activeKey: 'pending-B', sessions: { sA: a, 'pending-B': b } })
    )
    check('sB', false)
    dom.act(() =>
      useChatStore.setState({
        activeKey: 'sB',
        sessions: {
          sA: a,
          sB: {
            ...b,
            session: {
              ...b.session,
              loadingSession: false,
              transcriptChanges: recordChange(b.session.transcriptChanges, {
                kind: 'append',
                ids: ['native-5']
              }),
              messages: [...a.session.messages]
            }
          }
        }
      })
    )
    check('sB', true)
  }
)
