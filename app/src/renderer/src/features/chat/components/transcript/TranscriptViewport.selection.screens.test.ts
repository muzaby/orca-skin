// 0326 ΔV2 rev 3 · VP-29 AR-09 ↔ IT-09 — the IT-only seats ① (s2) and ⑤ (s10) through the
// production screens (`TranscriptView` → Claude / OpenCode `Timeline` → `TranscriptViewport`).
// ΔV2 rev 5 adds the session seats S1~S9 (s9-screens · s10b-screens): the store holds two sessions
// `s` and `t` with the same message ids, and the screen reads the active one.
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode,
  type Layout
} from '../../../../shared/ui/renderHarness.testfixture'
import type { Backend } from '../../../../../../shared/ipc'
import type { AgentKind } from '../../../../../../shared/agent-kind'
import type { Message } from '../../reducer/chatReducer'
import { useChatStore } from '../../store/chatStore'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'
import { installViewportSelection } from './viewportSelection.testfixture'
import { TranscriptView } from './TranscriptView'

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
// `selected` is observed where it reaches `OpenCodeTimelineRow` (ΔV2 rev 4): the row hook still runs
// its production body, and a selected row is shown by the text mock. The Markdown-mode continuity
// itself stays locked by 0325 `Timeline.selection.test.ts` (VP-36) — in the production assembly a
// turn end mounts the meta row and D-103 cancels the selection first.
vi.mock('../../harnesses/opencode/transcript/viewState', async (original) => {
  const module = await original<typeof import('../../harnesses/opencode/transcript/viewState')>()
  return {
    ...module,
    useTimelineMarkdownMode: (streaming: boolean, selected: boolean) =>
      module.useTimelineMarkdownMode(streaming, selected) || selected
  }
})
vi.mock('../../harnesses/opencode/transcript/Text', async () => {
  const { createElement } = await import('react')
  return {
    OpenCodeText: ({ source, streaming }: { source: string; streaming?: boolean }) =>
      createElement('p', { 'data-markdown-mode': streaming ? 'streaming' : 'complete' }, source)
  }
})

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const ROW = 80

function scrollTarget(): { current: HTMLDivElement | null } {
  const events = new EventTarget()
  let mounted: HTMLDivElement | null = null
  return {
    get current() {
      return mounted
    },
    set current(element) {
      mounted = element
      if (element)
        Object.assign(element, {
          addEventListener: events.addEventListener.bind(events),
          removeEventListener: events.removeEventListener.bind(events),
          dispatchEvent: events.dispatchEvent.bind(events)
        })
    }
  }
}

function mountScreen(
  backend: Backend,
  agentKind: AgentKind,
  messages: Message[],
  inflight = false
): { render: () => void; scrollRef: { current: HTMLDivElement | null } } {
  installChatStoreHarness({ messages, backend, agentKind, inflight })
  // A second session with the same message ids — the block keys collide like archived `x:<index>`.
  const first = useChatStore.getState().sessions.s
  useChatStore.setState({
    sessions: {
      ...useChatStore.getState().sessions,
      t: { ...first, session: { ...first.session, sessionId: 't' } }
    }
  })
  // Every virtual row is ROW px tall; the scroller is 400 px.
  const layout: Layout = (node) => {
    const viewport = node.closest('[data-behavior="virtualizable"]')
    const row = node.closest('[data-index]')
    if (!row || !viewport)
      return { rect: { top: 0, left: 0, width: 600, height: 400 }, scrollHeight: 200 * ROW }
    const index = Number(row.getAttribute('data-index'))
    return { rect: { top: ROW * index - viewport.scrollTop, left: 0, width: 600, height: ROW } }
  }
  dom = installFakeDom({ innerWidth: 800, innerHeight: 500, layout })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
  Object.assign(document, { fonts: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
  const scrollRef = scrollTarget()
  const contentRef = { current: null }
  function Screen(): React.JSX.Element {
    const session = useChatStore((state) => state.sessions[state.activeKey].session)
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
      isPinned: () => false,
      onScroll: () => {}
    })
  }
  return { render: () => dom!.render(createElement(Screen)), scrollRef }
}

function exchanges(n: number): Message[] {
  return Array.from({ length: n }, (_, i): Message[] => [
    { id: `u:${i}`, role: 'user', createdAt: i * 2 + 1, parts: [{ type: 'text', text: `Q${i}` }] },
    {
      id: `a:${i}`,
      role: 'assistant',
      createdAt: i * 2 + 2,
      parts: [{ type: 'text', text: `Answer ${i} first line` }]
    }
  ]).flat()
}

const screens = [
  ['claude', 'code'],
  ['claude', 'work'],
  ['opencode', 'code']
] as const

describe('TranscriptViewport.selection via the production screens (ΔV2 rev 3 · s2 · s10)', () => {
  it.each(screens)(
    's2 %s %s: a selection into the overscan edge adds no row through the screen — the mount set equals the same scroll without a selection',
    (backend, agentKind) => {
      // One scroll sequence, run without and with a selection on a fresh screen each time.
      const run = (withSelection: boolean): { kept: number[]; moved: number[]; text: string } => {
        dom?.unmount()
        const { render, scrollRef } = mountScreen(backend, agentKind, exchanges(120))
        const { select, selection } = installViewportSelection(dom!)
        render()
        const scroller = dom!.query('[data-behavior="virtualizable"]')!
        const scrollTo = (top: number): void => {
          scroller.scrollTop = top
          dom!.act(() => scrollRef.current!.dispatchEvent(new Event('scroll')))
          // Let the virtualizer settle its measurements so the mount set is the scroll's own.
          for (let i = 0; i < 4; i++) render()
        }
        const mounted = (): number[] =>
          dom!.queryAll('[data-index]').map((n) => Number(n.getAttribute('data-index')))
        scrollTo(40 * ROW + 5)
        const before = mounted()
        expect(before.length).toBeGreaterThan(4)
        let text = ''
        if (withSelection) {
          const first = dom!.query(`[data-index="${before[1]}"]`)!
          const edge = dom!.query(`[data-index="${before.at(-1)}"]`)!
          select(first, 1, edge, 2)
          text = selection.toString()
          expect(selection.rangeCount).toBe(1)
        }
        // A sub-row scroll keeps the range; a one-row scroll moves it.
        scrollTo(40 * ROW + 6)
        const kept = mounted()
        if (withSelection) expect(selection.toString()).toBe(text)
        scrollTo(41 * ROW + 6)
        return { kept, moved: mounted(), text }
      }
      const plain = run(false)
      const selected = run(true)
      expect(selected.text.length).toBeGreaterThan(0)
      expect(selected.kept).toEqual(plain.kept)
      expect(selected.moved).toEqual(plain.moved)
    }
  )

  it.each([true, false])(
    's10 opencode code (selection %s): rows between the selection ends receive `selected` through the OpenCode Timeline, and release clears it',
    (withSelection) => {
      const { render } = mountScreen('opencode', 'code', [
        { id: 'u:1', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'question' }] },
        { id: 'a:0', role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'earlier' }] },
        { id: 'u:2', role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'next' }] },
        { id: 'a:1', role: 'assistant', createdAt: 4, parts: [{ type: 'text', text: 'later' }] },
        { id: 'u:3', role: 'user', createdAt: 5, parts: [{ type: 'text', text: 'last' }] },
        { id: 'a:2', role: 'assistant', createdAt: 6, parts: [{ type: 'text', text: 'focus' }] },
        { id: 'u:4', role: 'user', createdAt: 7, parts: [{ type: 'text', text: 'more' }] },
        { id: 'a:3', role: 'assistant', createdAt: 8, parts: [{ type: 'text', text: 'after' }] }
      ])
      const { select, selection } = installViewportSelection(dom!)
      render()
      const text = (key: string): FakeNode =>
        dom!.query(`[data-block-key="${key}"]`)!.querySelector('[data-markdown-mode]')!
      const modes = (): (string | null)[] =>
        ['a:0:text:0', 'a:1:text:0', 'a:2:text:0', 'a:3:text:0'].map((key) =>
          text(key).getAttribute('data-markdown-mode')
        )
      const none = ['complete', 'complete', 'complete', 'complete']
      expect(modes()).toEqual(none)
      if (withSelection) select(text('a:0:text:0'), 2, text('a:2:text:0'), 3)
      render()
      // Both ends and the row between are selected; the row after the focus is not.
      expect(modes()).toEqual(
        withSelection ? ['streaming', 'streaming', 'streaming', 'complete'] : none
      )
      selection.removeAllRanges()
      dom!.act(() => {
        for (const listener of dom!.documentListeners.get('selectionchange') ?? []) listener({})
      })
      render()
      expect(modes()).toEqual(none)
    }
  )

  // ΔV2 rev 5 · S1~S5: the screens that keep one viewport across sessions
  // (`remountTranscriptBySession: false`) end a suppressed gesture on a session switch (D-110 ⓑ).
  it.each([
    ['claude', 'work'],
    ['opencode', 'code']
  ] as const)(
    's9-screens %s %s: switching the active session releases a suppressed drag',
    (backend, agentKind) => {
      const { render, scrollRef } = mountScreen(backend, agentKind, exchanges(120))
      const { select, selection } = installViewportSelection(dom!)
      render()
      const viewport = (): FakeNode => dom!.query('[data-transcript-viewport]')!
      const onPointerDown = viewport().props.onPointerDown as (event: { button: number }) => void
      dom!.act(() => onPointerDown({ button: 0 }))
      const rows = dom!.queryAll('[data-index]')
      select(rows[1], 0, rows.at(-1)!, 1)
      expect(selection.rangeCount).toBe(1)
      dom!.query('[data-behavior="virtualizable"]')!.scrollTop = 80 * ROW
      dom!.act(() => scrollRef.current!.dispatchEvent(new Event('scroll')))
      for (let i = 0; i < 4; i++) render()
      expect(selection.rangeCount).toBe(0)
      expect(viewport().getAttribute('data-selection-suppressed')).toBe('')
      dom!.act(() => useChatStore.setState({ activeKey: 't' }))
      render()
      expect(viewport().getAttribute('data-selection-suppressed')).toBeNull()
    }
  )

  // ΔV2 rev 5 · S3·S4 · S6~S9: `selected` follows the session that made the selection (D-110 ⓒ).
  it('s10b-screens opencode code: another session with the same keys shows no selection, and a selection made there is shown', () => {
    const { render } = mountScreen('opencode', 'code', [
      { id: 'u:1', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'question' }] },
      { id: 'a:0', role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'earlier' }] },
      { id: 'u:2', role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'next' }] },
      { id: 'a:1', role: 'assistant', createdAt: 4, parts: [{ type: 'text', text: 'later' }] },
      { id: 'u:3', role: 'user', createdAt: 5, parts: [{ type: 'text', text: 'last' }] },
      { id: 'a:2', role: 'assistant', createdAt: 6, parts: [{ type: 'text', text: 'focus' }] }
    ])
    const { select } = installViewportSelection(dom!)
    render()
    const text = (key: string): FakeNode =>
      dom!.query(`[data-block-key="${key}"]`)!.querySelector('[data-markdown-mode]')!
    const modes = (): (string | null)[] =>
      ['a:0:text:0', 'a:1:text:0', 'a:2:text:0'].map((key) =>
        text(key).getAttribute('data-markdown-mode')
      )
    select(text('a:0:text:0'), 2, text('a:2:text:0'), 3)
    render()
    expect(modes()).toEqual(['streaming', 'streaming', 'streaming'])
    // ② The same keys in session `t` are not the selection of session `s`.
    dom!.act(() => useChatStore.setState({ activeKey: 't' }))
    render()
    expect(modes()).toEqual(['complete', 'complete', 'complete'])
    // ③ A selection made in `t` is recorded for `t`.
    select(text('a:1:text:0'), 1, text('a:2:text:0'), 2)
    render()
    expect(modes()).toEqual(['complete', 'streaming', 'streaming'])
  })
})
