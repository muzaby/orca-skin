import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { chatReducer, initialChatState, type Message } from '../../reducer/chatReducer'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { clearDisclosures, getDisclosure, setDisclosure } from '../../store/disclosureStore'
import { installViewportSelection } from './viewportSelection.testfixture'
import { TranscriptViewport, type ViewportBlockBase } from './TranscriptViewport'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})

function makeScroller(height = 600, scrollTop = 0): HTMLDivElement {
  return {
    scrollTop,
    scrollHeight: 400000,
    clientHeight: height,
    clientWidth: 600,
    getBoundingClientRect: () => ({ top: 0, bottom: height, left: 0, width: 600, height }),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: (selector: string) => dom!.query(selector),
    contains: (node: Node) => dom!.body.contains(node),
    scrollTo: () => {}
  } as unknown as HTMLDivElement
}

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  clearDisclosures('s-trans')
})

describe('TranscriptViewport.transition (VP-22 · SD-02 ↔ ST-02 · EP-10 ④ · EP-11 ⑦)', () => {
  it('sending after a 5,000-block answer keeps mounted count, keys, measurements, expansion and selection', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const scroller = makeScroller(600, 0)
    const scrollRef = { current: scroller }
    const sizeCache = new Map<string, number>()

    // Build a 5,000-block answer (2,500 turns = 5,000+ blocks)
    const messages: Message[] = []
    for (let i = 0; i < 2500; i++) {
      messages.push({
        id: `u:${i}`,
        role: 'user',
        createdAt: i * 10,
        parts: [{ type: 'text', text: `q ${i}` }]
      })
      messages.push({
        id: `a:${i}`,
        role: 'assistant',
        createdAt: i * 10 + 1,
        parts: [{ type: 'text', text: `ans ${i}` }]
      })
    }

    let state = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's-trans',
        title: 't',
        agentKind: 'code',
        createdAt: 0,
        updatedAt: 0,
        messages
      } as never,
      complete: true
    })

    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's-trans' })
    const snap1 = model.advance(
      { messages: state.messages, transcriptChanges: state.transcriptChanges },
      { forkable: true, reserve: true }
    )
    expect(snap1.count).toBeGreaterThanOrEqual(5000)

    // Pre-populate sizeCache & disclosure expansion on visible block
    const watchedKey = snap1.keyAt(1)
    sizeCache.set(watchedKey, 128)
    setDisclosure('s-trans', watchedKey, true)

    dom.render(
      createElement(TranscriptViewport<ViewportBlockBase>, {
        snapshot: snap1 as never,
        scrollRef,
        sizeCache,
        estimateSizePx: 80,
        enableReserveGap: true,
        renderBlock: (b) =>
          createElement('div', { 'data-part-key': b.partKeys?.[0] ?? b.key }, b.key)
      })
    )
    const { select, selection } = installViewportSelection(dom)
    const anchor = dom.query('[data-index="1"]')!
    const focus = dom.query('[data-index="0"]')!
    select(anchor, 3, focus, 1)
    const selected = selection.toString()
    expect(selected.length).toBeGreaterThan(0)
    const mountedBefore = dom.queryAll('[data-block-key]')
    const keysBefore = mountedBefore.map((n) => n.getAttribute('data-block-key'))
    expect(mountedBefore.length).toBeLessThan(60) // virtualized, never mounts 5,000

    // Send a new user message (appends at tail; previous answer stays in the same list)
    state = chatReducer(state, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      messageKey: 'u:next-turn',
      text: 'follow-up question',
      createdAt: 999999
    } as never)
    const snap2 = model.advance(
      { messages: state.messages, transcriptChanges: state.transcriptChanges },
      { forkable: true, reserve: true }
    )

    dom.render(
      createElement(TranscriptViewport<ViewportBlockBase>, {
        snapshot: snap2 as never,
        scrollRef,
        sizeCache,
        estimateSizePx: 80,
        enableReserveGap: true,
        renderBlock: (b) =>
          createElement('div', { 'data-part-key': b.partKeys?.[0] ?? b.key }, b.key)
      })
    )
    const mountedAfter = dom.queryAll('[data-block-key]')
    const keysAfter = mountedAfter.map((n) => n.getAttribute('data-block-key'))

    // Mounted count, keys, measurement cache entry, and disclosure expansion all preserved
    expect(mountedAfter.length).toBe(mountedBefore.length)
    expect(keysAfter).toEqual(keysBefore)
    expect(sizeCache.get(watchedKey)).toBe(128)
    expect(getDisclosure('s-trans', watchedKey)).toBe(true)
    expect(snap2.indexOf(watchedKey)).toBe(snap1.indexOf(watchedKey))
    expect(selection.toString()).toBe(selected)
    expect(selection.anchorNode?.closest('[data-index]')).toBe(anchor)
    expect(selection.focusNode?.closest('[data-index]')).toBe(focus)
    expect([selection.anchorOffset, selection.focusOffset]).toEqual([3, 1])
  })
})
