import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import type { TranscriptTimelineProps } from '../../harnesses/contracts'
import { TranscriptView } from './TranscriptView'
import * as claudeBlocks from '../../harnesses/claude/transcript/claudeBlocks'
import * as openCodeBlocks from '../../harnesses/opencode/transcript/openCodeBlocks'
import type { BlockSnapshot } from '../../lib/transcript/blockList'
import type { ViewportBlockBase } from './TranscriptViewport'
import type { Message } from '../../reducer/chatReducer'
import { ingestChatEvent, useChatStore } from '../../store/chatStore'
import { flushRaf, installChatStoreHarness } from '../../store/chatStore.testHarness'

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
  useShallow: <T, U>(select: (state: T) => U) => select
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})
vi.mock('../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key })
}))

const queuedFrame = globalThis.requestAnimationFrame
let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderTranscript(backend: 'claude' | 'opencode', agentKind: 'code' | 'work'): FakeDom {
  const rendered = installFakeDom({
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
  vi.stubGlobal('getComputedStyle', () => ({ lineHeight: '22px', fontSize: '14px' }))
  Object.assign(document, { fonts: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
  const scrollRef: TranscriptTimelineProps['scrollRef'] = { current: null }
  const contentRef: TranscriptTimelineProps['contentRef'] = { current: null }
  function Transcript(): React.JSX.Element {
    const session = useChatStore((state) => state.sessions.s.session)
    return createElement(TranscriptView, {
      agentKind,
      backend,
      messages: session.messages,
      pendingSteer: [],
      inflight: session.inflight,
      loadingSession: false,
      anchored: false,
      scrollRef,
      contentRef,
      onScroll: () => {}
    })
  }
  rendered.render(createElement(Transcript))
  return rendered
}

describe('TranscriptViewport.live (VP-19 · EP-8 ⑩)', () => {
  it('b9: mounts separate committed and live OpenCode DOM keys when completion and next delta share a frame', () => {
    vi.stubGlobal('requestAnimationFrame', queuedFrame)
    installChatStoreHarness({
      backend: 'opencode',
      agentKind: 'code',
      inflight: true,
      messages: [
        { id: 'u:1', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'question' }] }
      ]
    })
    dom = renderTranscript('opencode', 'code')
    dom.act(() => {
      ingestChatEvent({
        type: 'message.delta',
        sessionId: 's',
        messageKey: 'a:A',
        delta: { text: 'draft' }
      })
      flushRaf()
    })
    expect(dom.query('[data-block-key="a:A:text:0"]')?.textContent).toContain('draft')
    dom.act(() => {
      ingestChatEvent({
        type: 'message.completed',
        sessionId: 's',
        messageKey: 'a:A',
        message: { text: 'final' }
      })
      ingestChatEvent({
        type: 'message.delta',
        sessionId: 's',
        messageKey: 'a:B',
        delta: { text: 'following' }
      })
      flushRaf()
    })
    expect(dom.query('[data-block-key="a:A:text:0"]')?.textContent).toContain('final')
    expect(dom.query('[data-block-key="a:B:text:0"]')?.textContent).toContain('following')
    expect(dom.query('[data-block-key="a:A:text:0"]')?.textContent).not.toContain('following')
    dom.act(() => {
      ingestChatEvent({
        type: 'message.completed',
        sessionId: 's',
        messageKey: 'a:B',
        message: { text: 'following' }
      })
      ingestChatEvent({
        type: 'message.delta',
        sessionId: 's',
        messageKey: 'a:B',
        delta: { text: ' same owner' }
      })
      flushRaf()
    })
    const merged = dom.query('[data-block-key="a:A:text:0"]')
    expect(merged?.textContent).toContain('finalfollowing same owner')
    expect(dom.query('[data-block-key="a:B:text:1"]')).toBeNull()
  })

  it.each([
    ['claude', 'code'],
    ['claude', 'work'],
    ['opencode', 'code']
  ] as const)('%s %s advances only at live appearance and completion', (backend, agentKind) => {
    vi.stubGlobal('requestAnimationFrame', queuedFrame)
    let partsReads = 0
    const messages: Message[] = Array.from({ length: 10_000 }, (_, index) => {
      const role = index % 2 === 0 ? 'user' : 'assistant'
      const parts = [{ type: 'text' as const, text: `historic ${index}` }]
      return {
        id: `${role === 'user' ? 'u' : 'a'}:${index}`,
        role,
        createdAt: index,
        get parts() {
          if (index >= 40 && index < 9_960) partsReads++
          return parts
        }
      }
    })
    messages.push({
      id: 'u:10000',
      role: 'user',
      createdAt: 10_000,
      parts: [{ type: 'text', text: 'latest question' }]
    })
    installChatStoreHarness({ messages, backend, agentKind, inflight: true })
    const claudeFactory = claudeBlocks.createClaudeBlockModel
    const openCodeFactory = openCodeBlocks.createOpenCodeBlockModel
    const advances = vi.fn<(snapshot: BlockSnapshot<ViewportBlockBase>) => void>()
    vi.spyOn(claudeBlocks, 'createClaudeBlockModel').mockImplementation((options) => {
      const model = claudeFactory(options)
      const advance = model.advance
      model.advance = (...args) => {
        const snapshot = advance(...args)
        advances(snapshot)
        return snapshot
      }
      return model
    })
    vi.spyOn(openCodeBlocks, 'createOpenCodeBlockModel').mockImplementation(() => {
      const model = openCodeFactory()
      const advance = model.advance
      model.advance = (...args) => {
        const snapshot = advance(...args)
        advances(snapshot)
        return snapshot
      }
      return model
    })

    dom = renderTranscript(backend, agentKind)
    const viewport = dom.query('[data-transcript-viewport]')!
    const historicalRow = dom.query('[data-index="0"]')
    expect(historicalRow).not.toBeNull()
    const liveKey = backend === 'claude' ? 'live:s' : 'a:10001:text:0'
    expect(advances.mock.lastCall?.[0].indexOf(liveKey)).toBe(-1)
    advances.mockClear()

    const delta = (
      text: string,
      type: 'message.delta' | 'message.reasoning.delta' = 'message.delta'
    ): void => {
      ingestChatEvent({
        type,
        sessionId: 's',
        messageKey: 'a:10001',
        delta: { text }
      })
      flushRaf()
    }
    dom.act(() => delta('live first'))
    expect(advances).toHaveBeenCalledTimes(1)
    expect(advances.mock.lastCall?.[0].indexOf(liveKey)).toBeGreaterThanOrEqual(0)
    // Reasoning visibility is a structural transition only when its buffer first becomes visible.
    dom.act(() => delta('reasoning first', 'message.reasoning.delta'))
    advances.mockClear()
    partsReads = 0

    for (let index = 0; index < 5; index++) {
      dom.act(() => {
        delta(' increment')
        delta(' step', 'message.reasoning.delta')
      })
      expect(useChatStore.getState().sessions.s.live.text).toBe(
        'live first' + ' increment'.repeat(index + 1)
      )
      expect(useChatStore.getState().sessions.s.live.reasoning).toBe(
        'reasoning first' + ' step'.repeat(index + 1)
      )
    }
    expect(advances).not.toHaveBeenCalled()
    expect(partsReads).toBe(0)
    expect(dom.query('[data-transcript-viewport]')).toBe(viewport)
    expect(dom.query('[data-index="0"]')).toBe(historicalRow)

    dom.act(() =>
      ingestChatEvent({
        type: 'message.reasoning',
        sessionId: 's',
        messageKey: 'a:10001',
        text: 'committed reasoning'
      })
    )
    expect(useChatStore.getState().sessions.s.live.reasoning).toBe('')
    advances.mockClear()
    dom.act(() =>
      ingestChatEvent({
        type: 'message.completed',
        sessionId: 's',
        messageKey: 'a:10001',
        message: { text: 'committed' }
      })
    )
    expect(advances).toHaveBeenCalledTimes(1)
    const committed = advances.mock.lastCall![0]
    const committedBlockIndex = committed.indexOf('a:10001:text:0')
    expect(committedBlockIndex).toBeGreaterThanOrEqual(0)
    if (backend === 'claude') expect(committed.indexOf(liveKey)).toBe(-1)
    expect(useChatStore.getState().sessions.s.live.text).toBe('')
    expect(useChatStore.getState().sessions.s.session.messages.at(-1)?.id).toBe('a:10001')
  })
})
