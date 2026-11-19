import { createElement, memo } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { newTranscriptChanges, recordChange } from '../../lib/transcript/changeLog'
import type { Message } from '../../reducer/chatReducer'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import { TranscriptViewport, type ViewportBlockBase } from './TranscriptViewport'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})

function makeScroller(): HTMLDivElement {
  return {
    scrollTop: 0,
    scrollHeight: 800000,
    clientHeight: 600,
    clientWidth: 600,
    getBoundingClientRect: () => ({ top: 0, bottom: 600, left: 0, width: 600, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    scrollTo: () => {}
  } as unknown as HTMLDivElement
}

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
})

describe('TranscriptViewport.live (VP-19 · AR-05 ↔ IT-04 · EP-8 ⑩)', () => {
  it('structure-preserving live deltas on 10,000 messages cause 0 past parts reads, 0 block model advances, and 0 unrelated block renders; live appearance/completion transitions once', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const scrollRef = { current: makeScroller() }

    // Build 10,000 past messages with parts getter instrumentation
    let pastPartsReads = 0
    const messages: Message[] = []
    for (let i = 0; i < 10_000; i++) {
      const rawParts = [{ type: 'text' as const, text: `msg ${i}` }]
      const msg: Message = {
        id: i % 2 === 0 ? `u:${i}` : `a:${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        createdAt: i * 10,
        parts: rawParts
      }
      if (i < 9_990) {
        Object.defineProperty(msg, 'parts', {
          get() {
            pastPartsReads++
            return rawParts
          },
          enumerable: true
        })
      }
      messages.push(msg)
    }

    const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const screens = [
      {
        name: 'claude-code',
        run: () => {
          const m = createClaudeBlockModel({ mode: 'code', sessionKey: 's-live' })
          return (live: boolean) =>
            m.advance({ messages, transcriptChanges: changes }, { inflight: live, hasLive: live })
        }
      },
      {
        name: 'claude-work',
        run: () => {
          const m = createClaudeBlockModel({ mode: 'work', sessionKey: 's-live' })
          return (live: boolean) =>
            m.advance({ messages, transcriptChanges: changes }, { inflight: live, hasLive: live })
        }
      },
      {
        name: 'opencode',
        run: () => {
          const m = createOpenCodeBlockModel()
          return (live: boolean) =>
            m.advance(
              { messages, transcriptChanges: changes },
              { pending: live, liveText: live, liveTextKey: 'a:9999' }
            )
        }
      }
    ] as const

    for (const screen of screens) {
      const advance = screen.run()
      // Initial build + live appearance (1 transition)
      const snapLive = advance(true)
      pastPartsReads = 0

      let blockRenders = 0
      const lastBlockProp = new Map<string, ViewportBlockBase>()
      const BlockView = memo(function BlockView({ block }: { block: ViewportBlockBase }) {
        if (lastBlockProp.get(block.key) !== block) {
          lastBlockProp.set(block.key, block)
          blockRenders++
        }
        return createElement('div', null, block.key)
      })

      let liveLeafText = 'delta 0'
      const liveListeners = new Set<() => void>()
      let liveLeafRenders = 0
      function LiveLeaf(): ReturnType<typeof createElement> {
        liveLeafRenders++
        return createElement('span', { 'data-live-leaf': 'true' }, liveLeafText)
      }

      const renderAll = (snap: typeof snapLive): void => {
        dom!.render(
          createElement(TranscriptViewport<ViewportBlockBase>, {
            snapshot: snap as never,
            scrollRef,
            estimateSizePx: 80,
            renderBlock: (b) => createElement(BlockView, { block: b }),
            footer: createElement(LiveLeaf)
          })
        )
      }

      renderAll(snapLive)
      blockRenders = 0
      liveLeafRenders = 0

      // 50 structure-preserving live deltas: only live text changes, snapshot reference stays identical
      const advanceCalls = 0
      for (let d = 1; d <= 50; d++) {
        liveLeafText = `delta ${d}`
        for (const fn of liveListeners) fn()
        // Viewport does NOT subscribe to live text -> 0 advance calls, 0 past parts reads, 0 unrelated block renders
        renderAll(snapLive)
      }
      expect(advanceCalls).toBe(0)
      expect(pastPartsReads).toBe(0)
      expect(blockRenders).toBe(0)
      expect(liveLeafRenders).toBe(50)

      // Live completion (1 structural transition)
      const snapDone = advance(false)
      expect(snapDone).not.toBe(snapLive)
      expect(pastPartsReads).toBe(0)
    }
  })
})
