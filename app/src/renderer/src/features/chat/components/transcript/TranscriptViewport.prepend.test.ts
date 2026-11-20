import type { Virtualizer } from '@tanstack/virtual-core'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { generateTranscriptFixture } from '../../dev/transcriptFixtures'
import { type ChatState, type Message } from '../../reducer/chatReducer'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import { createBlockList } from '../../lib/transcript/blockList'
import { chatActions } from '../../store/chatStore'
import { harnessSession, installChatStoreHarness } from '../../store/chatStore.testHarness'
import { clearDisclosures, getDisclosure, setDisclosure } from '../../store/disclosureStore'
import { installViewportSelection } from './viewportSelection.testfixture'
import { TranscriptViewport, writeScrollTop, type ViewportBlockBase } from './TranscriptViewport'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
let virtualizer: Virtualizer<HTMLDivElement, HTMLElement>
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  const useVirtualizer = useRealVirtualizerWithFakeHooks<HTMLDivElement, HTMLElement>
  return {
    useVirtualizer(options: Parameters<typeof useVirtualizer>[0]) {
      virtualizer = useVirtualizer(options)
      return virtualizer
    }
  }
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

function seedHistory(messages: Message[], agentKind: ChatState['agentKind'] = 'code'): ChatState {
  const rendererWindow = globalThis.window
  installChatStoreHarness({ messages, agentKind })
  if (rendererWindow) vi.stubGlobal('window', rendererWindow)
  return harnessSession()
}

function makeScroller(
  height = 400,
  scrollTop = 200,
  displacement: (index: number) => number = () => 0
): HTMLDivElement {
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
    querySelector: (selector: string) => dom!.query(selector),
    contains: (node: Node) => dom!.body.contains(node),
    querySelectorAll: (selector: string) => {
      const nodes = dom ? dom.queryAll(selector) : []
      for (const n of nodes) {
        const idxAttr =
          n.getAttribute('data-index') ?? n.closest?.('[data-index]')?.getAttribute('data-index')
        const idx = idxAttr !== null && idxAttr !== undefined ? Number(idxAttr) : 0
        ;(n as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => {
          const top = 140 + idx * 80 - (el.scrollTop - 120) + displacement(idx)
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
  clearDisclosures('s')
  dom = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('TranscriptViewport.prepend (VP-27 · SD-03 ↔ ST-03 · EP-12 ⑤⑥)', () => {
  it('replays latest turn, bottom placement and three single-turn prepends (turns 9, 8, 7) on each screen', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 0)
    )
    vi.stubGlobal('cancelAnimationFrame', clearTimeout)
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const { select, selection } = installViewportSelection(dom)

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
      const fixture = generateTranscriptFixture(screen.name, { turns: 11, loadedTurns: 1 })
      let state = seedHistory(
        fixture.loadedMessages,
        screen.name === 'claude-work' ? 'work' : 'code'
      )
      dom.unmount()
      const scroller = makeScroller(400, 120)
      const scrollRef = { current: scroller }
      let pinned = true
      const model = screen.create()
      let snap = model.advance({
        messages: state.messages,
        transcriptChanges: state.transcriptChanges
      })

      const renderSnap = (s: typeof snap): void => {
        dom!.render(
          createElement(TranscriptViewport<ViewportBlockBase>, {
            snapshot: s as never,
            scrollRef,
            estimateSizePx: 80,
            isPinned: () => pinned,
            renderBlock: (b) => createElement('div', null, b.key)
          })
        )
      }

      Object.defineProperty(scroller, 'scrollHeight', {
        get: () => scroller.clientHeight + Math.max(0, snap.count * 80 - 320)
      })
      renderSnap(snap)
      writeScrollTop(scroller, scroller.scrollHeight - scroller.clientHeight)
      expect(scroller.scrollTop + scroller.clientHeight).toBe(scroller.scrollHeight)

      pinned = false
      scroller.scrollTop = 120
      scroller.dispatchEvent(new Event('scroll'))
      const retained = snap.blockAt(snap.count - 1)
      const selector = `[data-block-key="${retained.key}"]`
      const original = dom.query(selector)!
      select(original, 4, original, 1)
      setDisclosure('s', retained.key, true)
      const originalSelection = selection.toString()
      expect(originalSelection).toHaveLength(3)

      // Prepend turns 9, 8, 7 one at a time
      for (const t of [9, 8, 7]) {
        const previousNode = dom.query(selector)!
        scroller.querySelectorAll('[data-block-key]')
        const previousTop = previousNode.getBoundingClientRect().top
        chatActions.prependHistory('s', fixture.remainingPrefixTurns[t], { reachedStart: false })
        state = harnessSession()
        snap = model.advance({
          messages: state.messages,
          transcriptChanges: state.transcriptChanges
        })
        renderSnap(snap)
        vi.advanceTimersByTime(20)
        scroller.querySelectorAll('[data-block-key]')
        const node = dom.query(selector)!
        expect(node).toBe(previousNode)
        expect(Math.abs(node.getBoundingClientRect().top - previousTop)).toBeLessThanOrEqual(1)
        expect(snap.indexOf(retained.key)).toBeGreaterThanOrEqual(0)
        expect(getDisclosure('s', retained.key)).toBe(true)
        expect(selection.toString()).toBe(originalSelection)
        expect([selection.anchorOffset, selection.focusOffset]).toEqual([4, 1])
      }
      expect(state.messages.map((m) => m.id)).toEqual([
        'u:fx-7',
        'a:fx-7',
        'u:fx-8',
        'a:fx-8',
        'u:fx-9',
        'a:fx-9',
        'u:fx-10',
        'a:fx-10'
      ])
    }
  })

  it('prepending one turn costs the same after 1 and 100 loaded turns', () => {
    const measurePrepend = (loadedTurns: number): { added: number; recreated: number } => {
      const initial: Message[] = []
      for (let i = 2; i <= loadedTurns + 1; i++) initial.push(...makeTurn(i))
      let state = seedHistory(initial)
      const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
      const before = model.advance({
        messages: state.messages,
        transcriptChanges: state.transcriptChanges
      })

      chatActions.prependHistory('s', makeTurn(1), { reachedStart: false })
      state = harnessSession()
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
    seedHistory(makeTurn(2))
    chatActions.prependHistory('s', makeTurn(1), { reachedStart: false })
    let state = harnessSession()
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

    chatActions.prependHistory(
      's',
      [{ id: 'u:0', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'earlier user' }] }],
      { reachedStart: false }
    )
    state = harnessSession()
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

describe('TranscriptViewport anchor corrections (VP-26 · EP-12 ①⑥⑦)', () => {
  it.each(['measurement', 'header', 'pinned', 'key', 'wheel', 'pointer', 'scroll'] as const)(
    'coalesces above-viewport changes and respects %s',
    (cause) => {
      vi.useFakeTimers()
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 0)
      )
      vi.stubGlobal('cancelAnimationFrame', clearTimeout)
      const observers = new Map<Element, ResizeObserverCallback>()
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(private readonly callback: ResizeObserverCallback) {}
          observe(element: Element): void {
            observers.set(element, this.callback)
          }
          disconnect = vi.fn()
        }
      )
      dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })

      let shift = 0
      let pinned = false
      const scroller = makeScroller(400, 250, (index) => (index === 0 ? 0 : shift))
      const queries = vi.spyOn(scroller, 'querySelectorAll')
      let scrollTop = scroller.scrollTop
      const writes: number[] = []
      Object.defineProperty(scroller, 'scrollTop', {
        get: () => scrollTop,
        set: (top: number) => {
          scrollTop = top
          writes.push(top)
          scroller.dispatchEvent(new Event('scroll'))
        }
      })
      const snapshot = createBlockList([
        { key: 'above' },
        { key: 'visible' },
        { key: 'after' }
      ]).snapshot()
      const sizeCache = new Map([
        ['above', 80],
        ['visible', 80],
        ['after', 80]
      ])
      dom.render(
        createElement(TranscriptViewport<{ key: string }>, {
          snapshot,
          scrollRef: { current: scroller },
          isPinned: () => pinned,
          sizeCache,
          estimateSizePx: 80,
          header: createElement('p', null, 'history'),
          renderBlock: (block) => createElement('p', null, block.key)
        })
      )
      scroller.dispatchEvent(new Event('scroll'))
      writes.length = 0
      queries.mockClear()

      function resize(size: number): void {
        shift = size
        const entry = {
          borderBoxSize: [{ blockSize: 80 + size }]
        } as unknown as ResizeObserverEntry
        if (cause === 'header') {
          const header = dom!.query('[data-transcript-header]') as unknown as Element
          const callback = observers.get(header)!
          expect(callback).toBeDefined()
          callback(
            [{ borderBoxSize: [{ blockSize: size }] } as unknown as ResizeObserverEntry],
            {} as ResizeObserver
          )
        } else {
          const row = dom!.query('[data-block-key="above"]') as unknown as HTMLElement
          virtualizer.options.measureElement(row, entry, virtualizer)
        }
      }

      resize(15)
      resize(35)
      expect(writes).toEqual([])
      if (cause === 'pinned') pinned = true
      if (cause === 'key')
        scroller.dispatchEvent(Object.assign(new Event('keydown'), { key: 'PageDown' }))
      if (cause === 'wheel') scroller.dispatchEvent(new Event('wheel'))
      if (cause === 'pointer') scroller.dispatchEvent(new Event('pointerdown'))
      if (cause === 'scroll') {
        scrollTop += 7
        scroller.dispatchEvent(new Event('scroll'))
      }
      vi.runOnlyPendingTimers()

      if (cause === 'measurement' || cause === 'header') {
        expect(writes).toEqual([285])
        // The writer synchronously emits scroll here. The viewport must skip recapturing its own scroll.
        expect(
          queries.mock.calls.filter(([selector]) => selector === '[data-part-key]')
        ).toHaveLength(1)
      } else {
        expect(writes).toEqual([])
      }
    }
  )
})
