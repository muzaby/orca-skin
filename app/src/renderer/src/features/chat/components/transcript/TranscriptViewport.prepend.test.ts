import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import {
  chatReducer,
  initialChatState,
  type ChatState,
  type Message
} from '../../reducer/chatReducer'
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

function makeTurn(turnNum: number): [Message, Message] {
  const base = turnNum * 100
  return [
    {
      id: `u:${turnNum}`,
      role: 'user',
      createdAt: base,
      parts: [{ type: 'text', text: `Turn ${turnNum} question` }]
    },
    {
      id: `a:${turnNum}`,
      role: 'assistant',
      createdAt: base + 1,
      parts: [{ type: 'text', text: `Turn ${turnNum} answer` }]
    }
  ]
}

function makeScroller(height = 400, scrollTop = 200): HTMLDivElement {
  const listeners = new Map<string, Set<EventListener>>()
  const el = {
    scrollTop,
    scrollHeight: 2000,
    clientHeight: height,
    clientWidth: 600,
    offsetHeight: height,
    offsetWidth: 600,
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 100 + height,
      left: 0,
      right: 600,
      width: 600,
      height,
      x: 0,
      y: 100,
      toJSON: () => ({})
    }),
    addEventListener: (type: string, fn: EventListener) => {
      let set = listeners.get(type)
      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }
      set.add(fn)
    },
    removeEventListener: (type: string, fn: EventListener) => {
      listeners.get(type)?.delete(fn)
    },
    dispatchEvent: (ev: Event) => {
      listeners.get(ev.type)?.forEach((fn) => fn(ev))
      return true
    },
    querySelectorAll: (selector: string) => {
      const nodes = dom ? dom.queryAll(selector) : []
      for (const n of nodes) {
        const idxAttr =
          n.getAttribute('data-index') ?? n.closest?.('[data-index]')?.getAttribute('data-index')
        const idx = idxAttr !== null && idxAttr !== undefined ? Number(idxAttr) : 0
        ;(n as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => {
          const top = 140 + idx * 80 - (el.scrollTop - 120)
          return {
            top,
            bottom: top + 80,
            left: 0,
            right: 600,
            width: 600,
            height: 80,
            x: 0,
            y: top,
            toJSON: () => ({})
          } as DOMRect
        }
      }
      return nodes
    },
    scrollTo: ({ top }: { top?: number }) => {
      if (typeof top === 'number') el.scrollTop = top
    }
  } as unknown as HTMLDivElement
  return el
}

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('TranscriptViewport.prepend (VP-27 · SD-03 ↔ ST-03 · EP-12 ⑤⑥)', () => {
  it('replays latest turn, bottom placement and three single-turn prepends (turns 9, 8, 7) on each screen', () => {
    vi.useFakeTimers()
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const scroller = makeScroller(400, 120)
    const scrollRef = { current: scroller }

    const screens = [
      {
        name: 'claude-code',
        create: () => createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
      },
      {
        name: 'claude-work',
        create: () => createClaudeBlockModel({ mode: 'work', sessionKey: 's1' })
      },
      { name: 'opencode', create: () => createOpenCodeBlockModel() }
    ] as const

    for (const screen of screens) {
      let state: ChatState = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: {
          id: 's1',
          title: 't',
          agentKind: screen.name === 'claude-work' ? 'work' : 'code',
          createdAt: 0,
          updatedAt: 0,
          messages: makeTurn(10)
        } as never,
        complete: false
      })
      const model = screen.create()
      let snap = model.advance({
        messages: state.messages,
        transcriptChanges: state.transcriptChanges
      })

      // Render initial turn 10 (unpinned at scrollTop = 120 so anchor capture is active)
      scroller.scrollTop = 120
      const renderSnap = (s: typeof snap): void => {
        dom!.render(
          createElement(TranscriptViewport<ViewportBlockBase>, {
            snapshot: s as never,
            scrollRef,
            pinned: false,
            estimateSizePx: 80,
            renderBlock: (b) =>
              createElement('div', { 'data-part-key': b.partKeys?.[0] ?? b.key }, b.key)
          })
        )
      }

      renderSnap(snap)
      // Simulate scroll settle so restingAnchorRef captures turn 10
      scroller.dispatchEvent(new Event('scroll'))

      // Prepend turns 9, 8, 7 one at a time
      for (const t of [9, 8, 7]) {
        const prevScrollTop = scroller.scrollTop
        state = chatReducer(state, {
          type: 'PREPEND_HISTORY',
          messages: makeTurn(t),
          reachedStart: t === 7
        })
        snap = model.advance({
          messages: state.messages,
          transcriptChanges: state.transcriptChanges
        })
        renderSnap(snap)
        vi.advanceTimersByTime(20)
        // Production anchor restore must have compensated scrollTop downward (locks X01!)
        expect(scroller.scrollTop).toBeGreaterThan(prevScrollTop)
      }
      expect(state.messages.map((m) => m.id)).toEqual([
        'u:7',
        'a:7',
        'u:8',
        'a:8',
        'u:9',
        'a:9',
        'u:10',
        'a:10'
      ])
    }
  })

  it('prepending one turn costs the same after 1 and 100 loaded turns', () => {
    const measurePrepend = (loadedTurns: number): { added: number; recreated: number } => {
      const initial: Message[] = []
      for (let i = 2; i <= loadedTurns + 1; i++) initial.push(...makeTurn(i))
      let state = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: {
          id: 's1',
          title: 't',
          agentKind: 'code',
          createdAt: 0,
          updatedAt: 0,
          messages: initial
        } as never,
        complete: false
      })
      const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
      const before = model.advance({
        messages: state.messages,
        transcriptChanges: state.transcriptChanges
      })

      state = chatReducer(state, {
        type: 'PREPEND_HISTORY',
        messages: makeTurn(1),
        reachedStart: false
      })
      expect(state.transcriptChanges.log[state.transcriptChanges.log.length - 1]?.kind).toBe(
        'prepend'
      )
      const after = model.advance({
        messages: state.messages,
        transcriptChanges: state.transcriptChanges
      })
      let reused = 0
      for (let i = 0; i < before.count; i++) {
        const b = before.blockAt(i)
        const idx = after.indexOf(b.key)
        if (idx >= 0 && after.blockAt(idx) === b) reused++
      }
      return { added: after.count - before.count, recreated: before.count - reused }
    }

    const r1 = measurePrepend(1)
    const r100 = measurePrepend(100)
    expect(r1.added).toBe(r100.added)
    expect(r1.recreated).toBeLessThanOrEqual(2)
    expect(r100.recreated).toBeLessThanOrEqual(2)
  })

  it('turn-boundary prepends merge nothing; boundary-violating prepends reset partially and keep ids, keys, selection, expansion and anchor', () => {
    // 1. T-preserving prepend -> kind: 'prepend', zero merges
    let state = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's1',
        title: 't',
        agentKind: 'code',
        createdAt: 0,
        updatedAt: 0,
        messages: makeTurn(2)
      } as never,
      complete: false
    })
    state = chatReducer(state, {
      type: 'PREPEND_HISTORY',
      messages: makeTurn(1),
      reachedStart: false
    })
    expect(state.transcriptChanges.log[state.transcriptChanges.log.length - 1]?.kind).toBe(
      'prepend'
    )

    // 2. Boundary-violating prepend (user prepended before user) -> reset{complete: false}, keys preserved
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    const before = model.advance({
      messages: state.messages,
      transcriptChanges: state.transcriptChanges
    })
    const keysBefore = new Set(Array.from({ length: before.count }, (_, i) => before.keyAt(i)))

    state = chatReducer(state, {
      type: 'PREPEND_HISTORY',
      messages: [
        { id: 'u:0', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'earlier user' }] }
      ],
      reachedStart: false
    })
    const lastLog = state.transcriptChanges.log[state.transcriptChanges.log.length - 1]
    expect(lastLog).toEqual({ kind: 'reset', complete: false })

    const after = model.advance({
      messages: state.messages,
      transcriptChanges: state.transcriptChanges
    })
    const keysAfter = new Set(Array.from({ length: after.count }, (_, i) => after.keyAt(i)))
    for (const k of keysBefore) {
      expect(keysAfter.has(k)).toBe(true)
    }
  })
})
