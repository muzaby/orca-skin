import { createElement } from 'react'
import { it, expect, vi, afterEach } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { setComputeClient, type ComputeClient } from '../../../../shared/compute/client'
import { docKey, type ComputeResults } from '../../../../shared/compute/protocol'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'
import { useChatStore, ingestChatEvent } from '../../store/chatStore'
import { TranscriptView } from './TranscriptView'
import { setVirtualization } from './TranscriptViewport'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'transcript-test-id'
}))
vi.mock('zustand', async (original) => {
  const { createFakeZustand } = await import('./viewportTestBridge.testfixture')
  return createFakeZustand(original)
})
vi.mock('zustand/react/shallow', () => ({
  useShallow: <T, U>(select: (state: T) => U): ((state: T) => U) => select
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})
vi.mock('../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key })
}))

const parsed = vi.hoisted(() => vi.fn<(source: string) => void>())
vi.mock('react-markdown', async (original) => {
  const lib = await original<typeof import('react-markdown')>()
  return {
    ...lib,
    default: (props: Parameters<typeof lib.default>[0]) => {
      parsed(props?.children ?? '')
      return lib.default(props)
    }
  }
})
let dom: FakeDom
afterEach(() => {
  dom?.unmount()
  setComputeClient(null)
  setVirtualization(true)
  vi.unstubAllGlobals()
  parsed.mockClear()
  vi.useRealTimers()
})
function tail(node: FakeNode): FakeNode | undefined {
  if (node.props['data-markdown-tail']) return node
  for (const child of node.children) {
    const hit = tail(child)
    if (hit) return hit
  }
  return undefined
}
it.each([
  ['claude', 'code'],
  ['claude', 'work'],
  ['opencode', 'code']
] as const)(
  '%s %s: bg0~bg4 동시 생성, 비활성 세션 귀속, 생성 중 복귀와 완료',
  async (backend, agentKind) => {
    vi.useFakeTimers()
    installChatStoreHarness({ inflight: true, turnStartedAt: 1, backend, agentKind })
    const a = useChatStore.getState().sessions.s
    useChatStore.setState({
      sessions: {
        s: a,
        b: { ...a, session: { ...a.session, sessionId: 'b' }, live: { ...a.live } }
      }
    })
    dom = installFakeDom({
      innerWidth: 900,
      innerHeight: 560,
      layout: () => ({ rect: { top: 0, left: 0, width: 800, height: 100 } })
    })
    vi.stubGlobal('getComputedStyle', () => ({ lineHeight: '22px', fontSize: '14px' }))
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      }
    )
    Object.assign(document, { fonts: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
    setVirtualization(false)
    const docs = new Map<string, string>()
    const sent: { text: string; deliver: () => void }[] = []
    const client: ComputeClient = {
      peek: () => undefined,
      openDocument(ref, { text }) {
        docs.set(docKey(ref), text)
        return {
          ref,
          available: true,
          onAvailable: () => () => {},
          release() {
            docs.delete(docKey(ref))
          }
        }
      },
      request(request) {
        if (!('doc' in request)) throw Error('unexpected request')
        const text = docs.get(docKey(request.doc))!
        const promise = new Promise<ComputeResults['markdown']>((resolve) =>
          sent.push({
            text,
            deliver: () =>
              resolve({ hast: { type: 'root', children: [{ type: 'text', value: text }] } })
          })
        )
        return { promise: promise as Promise<never>, cancel: vi.fn() }
      }
    }
    setComputeClient(client)
    const refs = { scrollRef: { current: null }, contentRef: { current: null } }
    function Screen(): React.JSX.Element {
      const entry = useChatStore((s) => s.sessions[s.activeKey])
      return createElement(TranscriptView, {
        ...refs,
        agentKind,
        backend,
        messages: entry.session.messages,
        pendingSteer: [],
        inflight: entry.session.inflight,
        loadingSession: false,
        anchored: false,
        onScroll: vi.fn()
      })
    }
    dom.render(createElement(Screen))
    const drain = (): void => {
      dom.act(() => {
        dom.frame()
      })
      dom.act(() => {})
    }
    const delta = (sessionId: string, text: string): void => {
      dom.act(() => ingestChatEvent({ type: 'message.delta', sessionId, delta: { text } }))
      drain()
    }
    const switchTo = (activeKey: string): void => {
      dom.act(() => useChatStore.setState({ activeKey }))
      drain()
    }
    const actResult = async (deliver: () => void): Promise<void> => {
      deliver()
      for (let i = 0; i < 6; i++) await Promise.resolve()
      drain()
    }
    let bText = ''
    for (const [i, chunk] of [' **B0001** ' + 'b'.repeat(4001), ' B0002 end'].entries()) {
      delta('s', i === 0 ? '**A0001** ' + 'a'.repeat(4001) : ' A0002')
      const before = useChatStore.getState().sessions.s
      delta('b', chunk)
      bText += chunk
      const state = useChatStore.getState()
      expect(state.sessions.s).toBe(before)
      expect(state.activeKey).toBe('s')
      expect(state.sessions.b.live.text).toBe(bText)
      expect(dom.body.textContent).not.toContain('B0001')
    }
    expect(sent.some((r) => r.text.includes('A0001'))).toBe(true)
    expect(sent.some((r) => r.text.includes('B0001'))).toBe(false)
    expect(parsed.mock.calls.some(([source]) => source.includes('B0001'))).toBe(false)
    switchTo('b')
    expect(tail(dom.body)?.props['data-markdown-tail']).toBe('raw')
    const bRequest = sent.find((r) => r.text.includes('B0001'))!
    expect(bRequest.text).toBe(bText)
    await actResult(sent[0].deliver)
    expect(dom.body.textContent).not.toContain('A0001')
    expect(dom.body.textContent.match(/B000[12]/g)).toEqual(['B0001', 'B0002'])
    await actResult(bRequest.deliver)
    expect(tail(dom.body)?.props['data-markdown-tail']).toBe('parsed')
    switchTo('s')
    dom.act(() =>
      ingestChatEvent({ type: 'message.completed', sessionId: 'b', message: { text: bText } })
    )
    drain()
    switchTo('b')
    if (backend === 'opencode') {
      // bg4 is pending a decision on message completion versus turn completion.
      expect(useChatStore.getState().sessions.b.live.text).toBe('')
      expect(useChatStore.getState().sessions.b.session.inflight).toBe(true)
      dom.act(() => ingestChatEvent({ type: 'telemetry', sessionId: 'b' }))
      drain()
    }
    expect(tail(dom.body)?.props['data-markdown-tail']).toBeUndefined()
    expect(dom.body.textContent.match(/B000[12]/g)).toEqual(['B0001', 'B0002'])
  }
)

it.todo('bg4 OpenCode: message.completed 직후 telemetry 전에 완료 Markdown 경로로 복귀 (G2)')
