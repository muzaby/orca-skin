import { fakeComputeClient } from '../../../../shared/compute/fakeClient.testfixture'
import { createElement } from 'react'
import { it, expect, vi, afterEach } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { setComputeClient, type ComputeClient } from '../../../../shared/compute/client'
import { parseMarkdown } from '../../../../shared/compute/worker/markdown'
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
const screens = [
  ['claude', 'code'],
  ['claude', 'work'],
  ['opencode', 'code']
] as const
it.each(
  screens.flatMap(([backend, agentKind]) =>
    (['bg4a', 'bg4b'] as const).map((mode) => ({ backend, agentKind, mode }))
  )
)(
  '$backend $agentKind $mode 동시 생성, 비활성 세션 귀속, 생성 중 복귀와 완료',
  async ({ backend, agentKind, mode }) => {
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
    const sent: { text: string; completed: boolean; deliver: () => void }[] = []
    const client: ComputeClient = {
      ...fakeComputeClient().client,
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
      request(request, options) {
        if (!('doc' in request)) throw Error('unexpected request')
        const text = docs.get(docKey(request.doc))!
        const promise = new Promise<ComputeResults['markdown']>((resolve) =>
          sent.push({
            text,
            completed: options?.cacheable !== false,
            deliver: () => resolve(parseMarkdown(text))
          })
        )
        return { promise: promise as Promise<never>, setPriority: vi.fn(), cancel: vi.fn() }
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
    const delta = (sessionId: string, text: string, messageKey = sessionId + ':M1'): void => {
      dom.act(() =>
        ingestChatEvent({ type: 'message.delta', sessionId, messageKey, delta: { text } })
      )
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
    for (const [i, chunk] of [
      '**B0001** [details](https://example.org/session-b) '.padEnd(
        10000 - ' B0002 end'.length,
        'b'
      ),
      ' B0002 end'
    ].entries()) {
      delta('s', i === 0 ? '**A0001** ' + 'a'.repeat(4001) : ' A0002')
      const before = useChatStore.getState().sessions.s
      delta('b', chunk)
      bText += chunk
      const state = useChatStore.getState()
      expect(state.sessions.s, 'bg0 inactive update preserves active entry').toBe(before)
      expect(state.activeKey).toBe('s')
      expect(state.sessions.b.live.text).toBe(bText)
      expect(dom.body.textContent).not.toContain('B0001')
    }
    expect(sent.some((r) => r.text.includes('A0001'))).toBe(true)
    expect(
      sent.some((r) => r.text.includes('B0001')),
      'bg1 no background parse'
    ).toBe(false)
    expect(parsed.mock.calls.some(([source]) => source.includes('B0001'))).toBe(false)
    if (mode === 'bg4b') {
      switchTo('b')
      expect(dom.body.querySelector('[data-markdown-tail]')?.props['data-markdown-tail']).toBe(
        'raw'
      )
      const bRequest = sent.find((r) => r.text.includes('B0001'))!
      expect(bRequest.text, 'bg2 latest B request after activation').toBe(bText)
      await actResult(sent[0].deliver)
      expect(dom.body.textContent, 'bg3 late A result is absent from B').not.toContain('A0001')
      expect(dom.body.textContent.match(/B000[12]/g)).toEqual(['B0001', 'B0002'])
      await actResult(bRequest.deliver)
      expect(dom.body.querySelector('[data-markdown-tail]')?.props['data-markdown-tail']).toBe(
        'parsed'
      )
    }
    dom.act(() =>
      ingestChatEvent({
        type: 'message.completed',
        sessionId: 'b',
        messageKey: 'b:M1',
        message: { text: bText }
      })
    )
    drain()
    expect(useChatStore.getState().sessions.b.live.text).toBe('')
    if (mode === 'bg4a') {
      expect(useChatStore.getState().sessions.b.session.inflight).toBe(true)
      expect(
        sent.some((r) => r.text.includes('B0001')),
        'bg1 no background parse'
      ).toBe(false)
      expect(parsed.mock.calls.some(([source]) => source.includes('B0001'))).toBe(false)
      switchTo('b')
    }
    const markers = (): string[] | null => dom.body.textContent.match(/[BC]000[12]/g)
    expect(useChatStore.getState().sessions.b.session.inflight).toBe(true)
    const pending = dom.body.querySelector('[data-md-block-pending]')
    expect(pending?.textContent).toBe('')
    expect(dom.body.textContent).not.toContain('**B0001**')
    expect(dom.body.textContent).not.toContain('https://example.org/session-b')
    expect(dom.body.querySelector('[data-markdown-tail]')).toBeNull()
    const completed = sent.find((r) => r.completed && r.text === bText)
    expect(completed, 'the active session submits its completed text to the worker').toBeDefined()
    expect(parsed).not.toHaveBeenCalledWith(bText)
    await actResult(completed!.deliver)
    const link = dom.body.querySelector('[href="https://example.org/session-b"]')
    expect(link?.textContent).toBe('details')
    expect(link?.parent?.children.find((n) => n.tag === 'strong')?.textContent).toBe('B0001')
    expect(markers()).toEqual(['B0001', 'B0002'])
    expect(dom.body.querySelector('[data-md-block-pending]')).toBeNull()
    delta('b', 'C0001 '.padEnd(10000, 'c'), 'b:M2')
    expect(useChatStore.getState().sessions.b.session.inflight).toBe(true)
    expect(markers()).toEqual(['B0001', 'B0002', 'C0001'])
    const tails = dom.body.querySelectorAll('[data-markdown-tail]')
    expect(tails.map((node) => node.textContent.match(/[BC]000[12]/g))).toEqual([['C0001']])
    const beforeFinal = sent.length
    dom.act(() => ingestChatEvent({ type: 'telemetry', sessionId: 'b' }))
    drain()
    expect(useChatStore.getState().sessions.b.session.inflight).toBe(false)
    const finalRequests = sent.slice(beforeFinal).filter((r) => r.completed)
    expect(finalRequests.some((r) => r.text.includes('C0001'))).toBe(true)
    for (const request of finalRequests) await actResult(request.deliver)
    expect(markers()).toEqual(['B0001', 'B0002', 'C0001'])
    expect(dom.body.querySelector('[data-markdown-tail]')).toBeNull()
  }
)
