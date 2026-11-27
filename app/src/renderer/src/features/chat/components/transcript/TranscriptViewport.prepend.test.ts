import type { Virtualizer } from '@tanstack/virtual-core'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { generateTranscriptFixture } from '../../dev/transcriptFixtures'
import { type ChatState, type Message } from '../../reducer/chatReducer'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import * as viewportAnchor from '../../lib/transcript/viewport/anchor'
import { startEntryMotion } from '../../lib/transcript/viewport/entryMotion'
import { messageOrderFor } from '../../lib/transcript/messageOrder'
import { createBlockList } from '../../lib/transcript/blockList'
import { chatActions } from '../../store/chatStore'
import { harnessSession, installChatStoreHarness } from '../../store/chatStore.testHarness'
import { clearDisclosures, getDisclosure, setDisclosure } from '../../store/disclosureStore'
import { installViewportSelection } from './viewportSelection.testfixture'
import { TranscriptViewport, writeScrollTop, type ViewportBlockBase } from './TranscriptViewport'

vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
let virtualizer: Virtualizer<HTMLDivElement, HTMLElement>
let waitForNativeScrollEvent = false
const measureVirtualKeys = { enabled: false, calls: 0 }
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  const useVirtualizer = useRealVirtualizerWithFakeHooks<HTMLDivElement, HTMLElement>
  type KeyAt = NonNullable<Parameters<typeof useVirtualizer>[0]['getItemKey']>
  const measuredCallbacks = new WeakMap<KeyAt, KeyAt>()
  return {
    useVirtualizer(options: Parameters<typeof useVirtualizer>[0]) {
      const getItemKey = options.getItemKey
      if (measureVirtualKeys.enabled && getItemKey) {
        let measured = measuredCallbacks.get(getItemKey)
        if (!measured) {
          measured = (index) => {
            measureVirtualKeys.calls++
            return getItemKey(index)
          }
          measuredCallbacks.set(getItemKey, measured)
        }
        options = { ...options, getItemKey: measured }
      }
      if (waitForNativeScrollEvent && !options.observeElementOffset) {
        // Chromium's offset observer subscribes without emitting a synthetic 0
        // before the virtualizer applies the requested initial position.
        options = { ...options, observeElementOffset: () => undefined }
      }
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
  measureVirtualKeys.enabled = false
  waitForNativeScrollEvent = false
  dom?.unmount()
  clearDisclosures('s')
  dom = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('TranscriptViewport.prepend (VP-27 · SD-03 ↔ ST-03 · EP-12 ⑤⑥)', () => {
  it('reuses a measured row on ref attach and accepts its next observed height', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const observers = new Map<Element, ResizeObserverCallback>()
    class RowObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(element: Element): void {
        observers.set(element, this.callback)
      }
      unobserve(element: Element): void {
        observers.delete(element)
      }
      disconnect = vi.fn()
    }
    const scroller = Object.assign(makeScroller(), {
      ownerDocument: { defaultView: Object.assign(window, { ResizeObserver: RowObserver }) }
    })
    const sizes = new Map([['known', 52]])
    const blocks = createBlockList([{ key: 'known' }])
    dom.render(
      createElement(TranscriptViewport<{ key: string }>, {
        snapshot: blocks.snapshot(),
        scrollRef: { current: scroller },
        sizeCache: sizes,
        isPinned: () => true,
        renderBlock: (block) => createElement('p', null, block.key)
      })
    )
    const rect = vi.fn(() => ({ height: 71 }))
    const row = {
      isConnected: true,
      getAttribute: (name: string) => (name === 'data-index' ? '0' : 'known'),
      getBoundingClientRect: rect
    } as unknown as HTMLElement

    virtualizer.measureElement(row)
    expect(observers.has(row)).toBe(true)
    expect(virtualizer.measurementsCache[0].size).toBe(52)
    expect(rect).not.toHaveBeenCalled()
    const observed = {
      target: row,
      borderBoxSize: [{ blockSize: 69 }]
    } as unknown as ResizeObserverEntry
    observers.get(row)!([observed], {} as ResizeObserver)
    expect(sizes.get('known')).toBe(69)
    expect(virtualizer.getVirtualItems()[0].size).toBe(69)
    expect(rect).not.toHaveBeenCalled()

    sizes.delete('known')
    virtualizer.measureElement(row)
    expect(sizes.get('known')).toBe(71)
    expect(rect).toHaveBeenCalledTimes(1)

    const late = observers.get(row)!
    const replacement = {
      ...row,
      getBoundingClientRect: () => ({ height: 93 })
    } as unknown as HTMLElement
    virtualizer.measureElement(replacement)
    observers.get(replacement)!(
      [
        {
          target: replacement,
          borderBoxSize: [{ blockSize: 93 }]
        } as unknown as ResizeObserverEntry
      ],
      {} as ResizeObserver
    )
    late([observed], {} as ResizeObserver)
    expect(sizes.get('known')).toBe(93)
    expect(virtualizer.getVirtualItems()[0].size).toBe(93)
  })

  it('measures the actual row when a saved height has no observer to refresh it', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const sizes = new Map([['old', 46]])
    dom.render(
      createElement(TranscriptViewport<{ key: string }>, {
        snapshot: createBlockList([{ key: 'old' }]).snapshot(),
        sizeCache: sizes,
        scrollRef: { current: makeScroller() },
        isPinned: () => true,
        renderBlock: () => null
      })
    )
    const rect = vi.fn(() => ({ height: 81 }))
    const row = {
      isConnected: true,
      getBoundingClientRect: rect,
      getAttribute: (name: string) => (name === 'data-index' ? '0' : 'old')
    } as unknown as HTMLElement
    virtualizer.measureElement(row)
    expect(sizes.get('old')).toBe(81)
    expect(virtualizer.getVirtualItems()[0].size).toBe(81)
    expect(rect).toHaveBeenCalledOnce()
  })

  it.each([false, true])('measures cold mounted rows before positioning, pinned=%s', (pinned) => {
    const calls: string[] = []
    let height = 99
    dom = installFakeDom({
      innerWidth: 1200,
      innerHeight: 900,
      layout: (node) => {
        const key = node.getAttribute('data-block-key')
        if (key !== null) {
          calls.push('read:' + key)
          return {
            rect: {
              top: 100 * Number(node.getAttribute('data-index')),
              left: 0,
              width: 600,
              height
            }
          }
        }
        return undefined
      }
    })
    const observers = new Map<Element, ResizeObserverCallback>()
    class RowObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(row: Element): void {
        const key = row.getAttribute?.('data-block-key')
        if (key) calls.push('observe:' + key)
        observers.set(row, this.callback)
      }
      unobserve(row: Element): void {
        observers.delete(row)
      }
      disconnect = vi.fn()
    }
    const scroller = Object.assign(makeScroller(200, 0), {
      ownerDocument: { defaultView: Object.assign(window, { ResizeObserver: RowObserver }) },
      querySelectorAll: (selector: string) => dom!.queryAll(selector)
    })
    const sizes = new Map<string, number>()
    const blocks = createBlockList(Array.from({ length: 20 }, (_, index) => ({ key: 'r' + index })))
    dom.render(
      createElement(TranscriptViewport<{ key: string }>, {
        snapshot: blocks.snapshot(),
        scrollRef: { current: scroller },
        isPinned: () => pinned,
        estimateSizePx: 100,
        overscan: 6,
        sizeCache: sizes,
        renderBlock: (block) => createElement('p', null, block.key)
      })
    )
    const below = dom.query('[data-block-key="r6"]') as unknown as HTMLElement
    const firstRegistration = calls.indexOf('observe:r0')
    expect(firstRegistration).toBeGreaterThan(0)
    expect(calls.slice(0, firstRegistration)).toContain('read:r1')
    expect(calls.slice(0, firstRegistration).includes('read:r6')).toBe(pinned)
    expect(sizes.get('r0')).toBe(99)
    expect(sizes.get('r6')).toBe(pinned ? 99 : undefined)
    expect(observers.has(below)).toBe(true)
    const resize = (row: HTMLElement, actual?: number): void => {
      const entry = {
        target: row,
        borderBoxSize: actual === undefined ? [] : [{ blockSize: actual }]
      }
      observers.get(row)!([entry as unknown as ResizeObserverEntry], {} as ResizeObserver)
    }
    resize(below, 137)
    expect(sizes.get('r6')).toBe(137)
    expect(virtualizer.getVirtualItems().find((item) => item.key === 'r6')?.size).toBe(137)
    height = 148
    resize(below)
    expect(sizes.get('r6')).toBe(148)
  })

  it.each([true, false])(
    'mounts the requested range on the first commit, bottom=%s',
    (startAtEnd) => {
      waitForNativeScrollEvent = true
      dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
      const scroller = makeScroller(200, 0)
      const blocks = createBlockList(Array.from({ length: 50 }, (_, i) => ({ key: String(i) })))
      const rendered: number[] = []
      dom.render(
        createElement(TranscriptViewport<{ key: string }>, {
          snapshot: blocks.snapshot(),
          scrollRef: { current: scroller },
          startAtEnd,
          initialOffset: 600,
          estimateSizePx: 100,
          overscan: 0,
          isPinned: () => startAtEnd,
          renderBlock: (block) => {
            rendered.push(Number(block.key))
            return null
          }
        })
      )
      const indices = [...new Set(rendered)]
      expect(indices).toEqual(startAtEnd ? [48, 49] : [6, 7])
      expect(scroller.scrollTop).toBe(startAtEnd ? 4800 : 600)
    }
  )

  it('mounts the head when the pinned transcript fits a newly attached scroller', () => {
    waitForNativeScrollEvent = true
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 1200 })
    const scroller = makeScroller(1200, 0)
    Object.defineProperty(scroller, 'scrollHeight', { value: scroller.clientHeight })
    // Chromium clamps a write to 0 without emitting a scroll event.
    Object.defineProperty(scroller, 'scrollTop', { get: () => 0, set: () => {} })
    const scrollRef = { current: null as HTMLDivElement | null }
    const blocks = createBlockList(
      Array.from({ length: 9 }, (_, index) => ({ key: String(index) }))
    )
    const rendered = new Set<string>()
    const props = {
      snapshot: blocks.snapshot(),
      scrollRef,
      startAtEnd: true,
      isPinned: () => true,
      estimateSizePx: 60,
      overscan: 6,
      renderBlock: (block: { key: string }) => {
        rendered.add(block.key)
        return null
      }
    }
    dom.render(createElement(TranscriptViewport<{ key: string }>, props))
    rendered.clear()
    scrollRef.current = scroller
    dom.render(createElement(TranscriptViewport<{ key: string }>, props))
    expect([...rendered]).toEqual(Array.from({ length: 9 }, (_, index) => String(index)))
  })

  it('AC5 requests once when the head enters and additional loading pulls never request again', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    vi.stubGlobal('Element', dom.body.constructor)
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const scroller = makeScroller(400, 120)
    const blocks = createBlockList([{ key: 'visible' }])
    const scrollRef = { current: scroller }
    const request = vi.fn(() => true)
    let pinned = true
    const render = (before: 'ready' | 'loading' | 'error' | 'end'): void =>
      dom!.render(
        createElement(TranscriptViewport<{ key: string }>, {
          snapshot: blocks.snapshot(),
          scrollRef,
          history: { before, request },
          isPinned: () => pinned,
          renderBlock: (block) => createElement('p', null, block.key)
        })
      )
    const pull = (): void => {
      const event = new Event('wheel', { cancelable: true })
      Object.assign(event, { deltaY: -12 })
      scroller.dispatchEvent(event)
    }
    render('ready')
    expect(request).not.toHaveBeenCalled()
    scroller.scrollTop = 0
    scroller.dispatchEvent(new Event('scroll'))
    expect(request).not.toHaveBeenCalled()
    pinned = false
    scroller.dispatchEvent(new Event('scroll'))
    expect(request.mock.calls).toEqual([['before']])
    render('loading')
    pull()
    pull()
    expect(request.mock.calls).toEqual([['before']])
    for (const state of ['end', 'error'] as const) {
      render(state)
      pull()
      scroller.dispatchEvent(new Event('scroll'))
    }
    expect(request.mock.calls).toEqual([['before']])
  })

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

      let groupedUserHeight = 0
      Object.defineProperty(scroller, 'scrollHeight', {
        get: () => scroller.clientHeight + Math.max(0, snap.count * 80 - 320) + groupedUserHeight
      })
      renderSnap(snap)
      writeScrollTop(scroller, scroller.scrollHeight - scroller.clientHeight)
      expect(scroller.scrollTop + scroller.clientHeight).toBe(scroller.scrollHeight)

      pinned = false
      scroller.scrollTop = 120
      scroller.dispatchEvent(new Event('scroll'))
      // The reading-anchor row (the viewport keeps it mounted across prepends) — a selection no longer keeps off-screen rows mounted (ΔV2 D-102).
      const retained = snap.blockAt(0)
      const selector = `[data-block-key="${retained.key}"]`
      const original = dom.query(selector)!
      select(original, 4, original, 1)
      setDisclosure('s', retained.key, true)
      const originalSelection = selection.toString()
      expect(originalSelection).toHaveLength(3)

      // Prepend turns 9, 8, 7 one at a time
      let selectionCancelled = false
      for (const t of [9, 8, 7]) {
        const previousNode = dom.query(selector)!
        scroller.querySelectorAll('[data-block-key]')
        const previousTop = previousNode.getBoundingClientRect().top
        const keysBefore = new Set(
          dom.queryAll('[data-index]').map((n) => n.getAttribute('data-block-key'))
        )
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
        // ΔV2 D-103: a prepend whose rows mount cancels the selection; otherwise it stays.
        const mountedNew = dom
          .queryAll('[data-index]')
          .some((n) => !keysBefore.has(n.getAttribute('data-block-key')))
        if (mountedNew || selectionCancelled) {
          selectionCancelled = true
          expect(selection.toString()).toBe('')
        } else {
          expect(selection.toString()).toBe(originalSelection)
          expect([selection.anchorOffset, selection.focusOffset]).toEqual([4, 1])
        }
      }
      expect(selectionCancelled, 'the replay exercises the row-mount cancel').toBe(true)
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
      pinned = true
      scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight
      const oldBottom = scroller.scrollTop
      chatActions.prependHistory('s', fixture.remainingPrefixTurns[6], { reachedStart: false })
      state = harnessSession()
      snap = model.advance({ messages: state.messages, transcriptChanges: state.transcriptChanges })
      renderSnap(snap)
      vi.advanceTimersByTime(20)
      const nextBottom = scroller.scrollHeight - scroller.clientHeight
      expect(nextBottom).toBeGreaterThan(oldBottom)
      expect(scroller.scrollTop).toBe(nextBottom)

      // A preceding user can share the first block's representative key on Claude.
      chatActions.prependHistory('s', [fixture.remainingPrefixTurns[5][0]], { reachedStart: false })
      state = harnessSession()
      snap = model.advance({ messages: state.messages, transcriptChanges: state.transcriptChanges })
      groupedUserHeight = 48
      renderSnap(snap)
      vi.advanceTimersByTime(20)
      expect(scroller.scrollTop).toBe(scroller.scrollHeight - scroller.clientHeight)
    }
  })

  it.each(['claude-code', 'claude-work', 'opencode'] as const)(
    'prepending one turn costs the same after 1 and 100 loaded turns (%s)',
    (screen) => {
      interface Costs {
        partsReads: number
        newBlocks: number
        boundaryBlocks: number
        rankWrites: number
        locationWrites: number
        keyLookups: number
      }
      function measurePrepend(loadedTurns: number): {
        fixed: Costs
        proportional: {
          chunkEntries: number
          orderEntries: number
          messages: number
          measurements: number
          virtualKeys: number
        }
      } {
        const fixture = generateTranscriptFixture(screen, { turns: loadedTurns + 1, loadedTurns })
        let partsReads = 0
        const counted = (message: Message): Message => {
          const parts = message.parts
          return {
            ...message,
            get parts() {
              partsReads++
              return parts
            }
          }
        }
        const prefix = fixture.remainingPrefixTurns[0].map(counted)
        let state = seedHistory(
          fixture.loadedMessages.map(counted),
          screen === 'claude-work' ? 'work' : 'code'
        )
        const model =
          screen === 'opencode'
            ? createOpenCodeBlockModel()
            : createClaudeBlockModel({
                mode: screen === 'claude-work' ? 'work' : 'code',
                sessionKey: 's'
              })
        const before = model.advance(state)
        const ranks: unknown = Reflect.get(messageOrderFor(state), 'ranks')
        partsReads = 0
        dom?.unmount()
        dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
        const scrollRef = { current: makeScroller() }
        const renderSnapshot = (value: typeof before): number => {
          measureVirtualKeys.enabled = true
          measureVirtualKeys.calls = 0
          dom!.render(
            createElement(TranscriptViewport<ViewportBlockBase>, {
              snapshot: value,
              scrollRef,
              renderBlock: (block) => createElement('p', null, block.key)
            })
          )
          virtualizer.getTotalSize()
          return measureVirtualKeys.calls
        }
        renderSnapshot(before)
        partsReads = 0
        let orderEntries = 0
        let rankWrites = 0
        let locationWrites = 0
        const retainedTailKey = before.keyAt(before.count - 1)
        let retainedTailLookups = 0
        let keyLookups = 0
        const mapSet = Map.prototype.set
        const mapGet = Map.prototype.get
        const isTranscriptChunk = (value: unknown): boolean =>
          typeof value === 'object' && value !== null && 'slots' in value
        Map.prototype.set = function (key: unknown, value: unknown): Map<unknown, unknown> {
          if (isTranscriptChunk(key)) orderEntries++
          if (this === ranks) rankWrites++
          if (isTranscriptChunk(value)) locationWrites++
          return mapSet.call(this, key, value)
        }
        Map.prototype.get = function (key: unknown): unknown {
          const value = mapGet.call(this, key)
          if (isTranscriptChunk(value)) {
            keyLookups++
            if (key === retainedTailKey) retainedTailLookups++
          }
          return value
        }
        let after: ReturnType<typeof model.advance>
        try {
          chatActions.prependHistory('s', prefix, { reachedStart: false })
          state = harnessSession()
          messageOrderFor(state)
          after = model.advance(state)
          // Materialize the final snapshot's lazily constructed chunk-order table.
          after.indexOf(after.keyAt(0))
        } finally {
          Map.prototype.set = mapSet
          Map.prototype.get = mapGet
        }
        if (screen !== 'opencode') expect(retainedTailLookups).toBe(0)
        expect(state.transcriptChanges.log.at(-1)?.kind).toBe('prepend')
        let boundaryBlocks = 0
        for (let i = 0; i < before.count; i++) {
          const block = before.blockAt(i)
          const index = after.indexOf(block.key)
          if (index < 0 || after.blockAt(index) !== block) boundaryBlocks++
        }
        const fixed = {
          partsReads,
          newBlocks: after.count - before.count,
          boundaryBlocks,
          rankWrites,
          locationWrites,
          keyLookups
        }
        const virtualKeys = renderSnapshot(after)
        const chunkOwners = new Set<unknown>()
        Map.prototype.get = function (key: unknown): unknown {
          const value = mapGet.call(this, key)
          if (isTranscriptChunk(value)) chunkOwners.add(value)
          return value
        }
        try {
          for (let i = 0; i < after.count; i++) after.indexOf(after.keyAt(i))
        } finally {
          Map.prototype.get = mapGet
        }
        return {
          fixed,
          proportional: {
            chunkEntries: chunkOwners.size,
            orderEntries,
            messages: state.messages.length,
            measurements: virtualizer.measurementsCache.length,
            virtualKeys
          }
        }
      }

      const short = measurePrepend(1)
      const long = measurePrepend(100)
      expect(short.fixed.partsReads).toBeGreaterThan(0)
      expect(short.fixed.newBlocks).toBeGreaterThan(0)
      expect(short.fixed.rankWrites).toBe(2)
      expect(short.fixed.locationWrites).toBeGreaterThan(0)
      expect(short.fixed.boundaryBlocks).toBeLessThanOrEqual(2)
      expect(long.fixed).toEqual(short.fixed)
      for (const key of Object.keys(short.proportional) as (keyof typeof short.proportional)[]) {
        expect(long.proportional[key], key).toBeGreaterThan(short.proportional[key])
      }
      expect({ short: short.proportional, long: long.proportional }).toMatchSnapshot()
    }
  )

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

    // A leading assistant can acquire its missing user without changing the existing part key.
    const [question, assistant] = makeTurn(2)
    for (const [screen, model] of [
      ['code', createClaudeBlockModel({ mode: 'code', sessionKey: 's' })],
      ['work', createClaudeBlockModel({ mode: 'work', sessionKey: 's' })],
      ['code', createOpenCodeBlockModel()]
    ] as const) {
      const initial = model.advance(seedHistory([assistant], screen))
      const response = initial.blockAt(0)
      if (response.kind !== 'segment') throw new Error('Expected an assistant segment')
      chatActions.prependHistory('s', [question], { reachedStart: false })
      const repaired = harnessSession()
      expect(repaired.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })
      expect(repaired.messages.map(({ id }) => id)).toEqual([question.id, assistant.id])
      const snapshot = model.advance(repaired)
      expect(snapshot.indexOf(response.key)).toBeGreaterThan(0)
      const retained = snapshot.blockAt(snapshot.indexOf(response.key))
      if (retained.kind !== 'segment') throw new Error('Expected a retained assistant segment')
      expect(retained.partKeys).toEqual(response.partKeys)
    }
  })
})

describe('TranscriptViewport anchor corrections (VP-26 · EP-12 ①⑥⑦)', () => {
  it.each(['merged', 'split', 'removed'] as const)(
    'retains the reading row outside overscan after a %s part (a5/a7)',
    (change) => {
      vi.useFakeTimers()
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
        setTimeout(() => cb(0), 0)
      )
      vi.stubGlobal('cancelAnimationFrame', clearTimeout)
      dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
      const scroller = makeScroller(400, 250)
      const scrollRef = { current: scroller }
      const blocks = createBlockList([
        { key: 'above', messageId: 'm', partKeys: ['previous'] },
        { key: 'reading-row', messageId: 'm', partKeys: ['reading'] },
        { key: 'next-row', messageId: 'm', partKeys: ['following'] }
      ])
      const render = (): void =>
        dom!.render(
          createElement(TranscriptViewport<ViewportBlockBase>, {
            snapshot: blocks.snapshot(),
            scrollRef,
            isPinned: () => false,
            estimateSizePx: 80,
            renderBlock: (block) => createElement('p', null, block.key)
          })
        )
      render()
      scroller.dispatchEvent(new Event('scroll'))
      const prefix = Array.from({ length: 20 }, (_, index) => ({
        key: 'prefix-' + index,
        messageId: 'older',
        partKeys: ['old-' + index]
      }))
      blocks.splice(1, 1, [
        ...prefix.map((block, index) =>
          change === 'split' && index === 0 ? { ...block, key: 'reading-row' } : block
        ),
        {
          key: 'replacement',
          messageId: 'm',
          partKeys: [change === 'removed' ? 'different' : 'reading']
        }
      ])
      render()
      const mounted = virtualizer.options.rangeExtractor({
        startIndex: 0,
        endIndex: 1,
        overscan: 0,
        count: blocks.snapshot().count
      })
      expect(mounted).toEqual([0, 1, change === 'removed' ? 22 : 21])
    }
  )

  it.each([
    'measurement',
    'async-own-scroll',
    'async-user-scroll',
    'header',
    'header-toggle',
    'mixed-prepend-live',
    'active-anchor-across-prepends',
    'entry-compositor-scroll',
    'footer-resize',
    'character',
    'pinned',
    'key',
    'wheel',
    'pointer',
    'header-wheel',
    'scroll'
  ] as const)('coalesces above-viewport changes and respects %s', (cause) => {
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
    let reflow = 0
    let pinned = false
    const isPinned = (): boolean => pinned
    let showHeader = cause !== 'header-toggle'
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
    const blocks = createBlockList([{ key: 'above' }, { key: 'visible' }, { key: 'after' }])
    const sizeCache = new Map([
      ['above', 80],
      ['visible', 80],
      ['after', 80]
    ])
    const scrollRef = { current: scroller }
    const render = (): void =>
      dom!.render(
        createElement(TranscriptViewport<{ key: string }>, {
          snapshot: blocks.snapshot(),
          scrollRef,
          isPinned,
          sizeCache,
          estimateSizePx: 80,
          header: showHeader ? createElement('p', null, 'history') : undefined,
          renderBlock: (block) => createElement('p', null, block.key)
        })
      )
    render()
    if (cause === 'character') {
      const part = dom.query('[data-part-key="visible"]')!
      const text = part.children[0].children[0]
      Object.assign(document, {
        caretPositionFromPoint: () => ({ offsetNode: text, offset: 3 }),
        createRange: () => {
          let caret = 0
          return {
            setStart: (node: Node, offset: number) => {
              expect(node).toBe(text)
              caret = offset
            },
            setEnd: vi.fn(),
            getBoundingClientRect: () => ({
              top: part.getBoundingClientRect().top + (caret === 3 ? reflow : 0),
              height: 16
            })
          }
        }
      })
    }
    scroller.dispatchEvent(new Event('scroll'))
    writes.length = 0
    queries.mockClear()

    function resize(size: number): void {
      shift = size
      const entry = {
        borderBoxSize: [{ blockSize: 80 + size }]
      } as unknown as ResizeObserverEntry
      if (cause === 'header' || cause === 'header-wheel') {
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

    if (cause === 'entry-compositor-scroll') {
      const reading = dom!.query('[data-block-key="visible"]')!
      const before = reading.getBoundingClientRect().top
      startEntryMotion(scroller, () => {}, true)
      blocks.splice(0, 0, [{ key: 'older' }])
      render()
      scrollTop += 100
      scroller.dispatchEvent(new Event('scroll'))
      expect(reading.getBoundingClientRect().top).toBe(before)
      return
    }

    if (cause === 'active-anchor-across-prepends' || cause === 'footer-resize') {
      const reading = dom!.query('[data-block-key="visible"]')!
      const before = reading.getBoundingClientRect().top
      blocks.splice(0, 0, [{ key: 'older' }])
      render()
      if (cause === 'active-anchor-across-prepends') {
        scrollTop += 22
        const recapture = vi.spyOn(viewportAnchor, 'captureAnchor')
        blocks.splice(0, 0, [{ key: 'oldest' }])
        render()
        expect(recapture).not.toHaveBeenCalled()
        recapture.mockRestore()
      } else {
        const viewport = dom!.query('[data-transcript-viewport]')!
        const slot = viewport.children.at(-1)! as unknown as Element
        const notify = observers.get(slot)
        expect(notify).toBeDefined()
        notify!(
          [{ target: slot, contentRect: { height: 39 } } as ResizeObserverEntry],
          {} as ResizeObserver
        )
      }
      vi.runOnlyPendingTimers()
      expect(reading.getBoundingClientRect().top).toBe(before)
      return
    }

    if (cause === 'header-toggle' || cause === 'mixed-prepend-live') {
      const reading = dom!.query('[data-block-key="visible"]')!
      const before = reading.getBoundingClientRect().top
      const notifyHeader = (height: number): void => {
        const slot = dom!.query('[data-transcript-header]') as unknown as Element
        observers.get(slot)?.(
          [{ borderBoxSize: [{ blockSize: height }] } as unknown as ResizeObserverEntry],
          {} as ResizeObserver
        )
      }
      if (cause === 'header-toggle') {
        for (const height of [36, 0]) {
          showHeader = height > 0
          shift = height
          render()
          notifyHeader(height)
          vi.runOnlyPendingTimers()
          expect(scrollTop).toBe(250 + height)
          expect(reading.getBoundingClientRect().top).toBe(before)
        }
        expect(writes).toEqual([286, 250])
      } else {
        blocks.splice(0, 0, [{ key: 'older' }])
        render()
        resize(15)
        shift += 20
        notifyHeader(20)
        blocks.splice(blocks.snapshot().count, 0, [{ key: 'live' }])
        render()
        expect(writes.at(-1)).toBe(365)
        vi.runOnlyPendingTimers()
        expect(writes.at(-1)).toBe(365)
        expect(reading.getBoundingClientRect().top).toBe(before)
      }
      return
    }

    const framesBeforeResize = vi.getTimerCount()
    resize(15)
    if (cause === 'character') reflow = 18
    resize(35)
    expect(vi.getTimerCount() - framesBeforeResize).toBe(0)
    expect(writes).toEqual([265, cause === 'character' ? 303 : 285])
    if (cause === 'pinned') pinned = true
    if (cause === 'key')
      scroller.dispatchEvent(Object.assign(new Event('keydown'), { key: 'PageDown' }))
    if (cause === 'wheel' || cause === 'header-wheel') scroller.dispatchEvent(new Event('wheel'))
    if (cause === 'pointer') scroller.dispatchEvent(new Event('pointerdown'))
    if (cause === 'scroll') {
      scrollTop += 7
      scroller.dispatchEvent(new Event('scroll'))
    }
    vi.runOnlyPendingTimers()

    if (cause === 'async-own-scroll' || cause === 'async-user-scroll') {
      expect(writes).toEqual([265, 285])
      // A delayed DOM scroll can acknowledge our own write or report a newer reader position.
      if (cause === 'async-user-scroll') scrollTop += 11
      scroller.dispatchEvent(new Event('scroll'))
      if (cause === 'async-own-scroll') scroller.dispatchEvent(new Event('scroll'))
      resize(48)
      vi.runOnlyPendingTimers()
      expect(writes).toEqual(cause === 'async-own-scroll' ? [265, 285, 298] : [265, 285])
      expect(scrollTop).toBe(cause === 'async-own-scroll' ? 298 : 296)
      return
    }

    if (cause === 'measurement' || cause === 'header' || cause === 'character') {
      expect(writes).toEqual([265, cause === 'character' ? 303 : 285])
      // The writer synchronously emits scroll here. The viewport must skip recapturing its own scroll.
      expect(
        queries.mock.calls.filter(([selector]) => selector === '[data-part-key]')
      ).toHaveLength(2)
      for (const shift of [48, 12, 0]) {
        const before = writes.length
        resize(shift)
        vi.runOnlyPendingTimers()
        expect(writes.slice(before)).toEqual([250 + shift + (cause === 'character' ? 18 : 0)])
      }
    } else {
      expect(writes).toEqual([265, 285])
      writes.length = 0
      if (cause !== 'pinned') {
        // Late ResizeObserver deliveries from the cancelled displacement span separate frames.
        for (const size of [46, 59]) {
          resize(size)
          vi.runOnlyPendingTimers()
          expect(writes).toEqual([])
        }
        if (cause === 'wheel') {
          // With no further deliveries, later growth of the very same snapshot is a new displacement.
          vi.runAllTimers()
        } else {
          blocks.splice(3, 0, [{ key: 'new' }])
          render()
        }
        vi.runOnlyPendingTimers()
        const before = scrollTop
        writes.length = 0
        resize(78)
        vi.runOnlyPendingTimers()
        expect(writes).toEqual([before + 19])
      }
    }
  })
})
