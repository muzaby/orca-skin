import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode,
  type Layout
} from '../../../../shared/ui/renderHarness.testfixture'
import { generateTranscriptFixture } from '../../dev/transcriptFixtures'
import { chatApi, sessionApi, settingsApi } from '../../../../shared/api/ipc'
import type { Backend } from '../../../../../../shared/ipc'
import type { AgentKind } from '../../../../../../shared/agent-kind'
import type { Message } from '../../reducer/chatReducer'
import { chatActions, useChatStore, useTranscriptView } from '../../store/chatStore'
import { clearDisclosures, setDisclosure, getDisclosure } from '../../store/disclosureStore'
import type { TranscriptResults } from '../../lib/canonicalBackground'
import { newTranscriptChanges, recordChange } from '../../lib/transcript/changeLog'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'
import { AgentTaskRow } from '../../harnesses/common/transcript/AgentTaskRow'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { partsToolCalls } from '../../lib/parts'
import { TranscriptView } from './TranscriptView'
import { HarnessScrollController } from './HarnessScrollController'
import type { ScrollAnchor } from '../../harnesses/common/transcript/scrollTypes'
import { timelineViewState } from '../../harnesses/opencode/transcript/viewState'
import { installViewportSelection } from './viewportSelection.testfixture'
import {
  setVirtualization,
  type TranscriptViewportProps,
  type ViewportBlockBase
} from './TranscriptViewport'

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
const portal = vi.hoisted(() =>
  vi.fn<(node: unknown, container: unknown) => unknown>((node) => node)
)
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: portal,
  flushSync: (fn: () => void) => dom!.act(fn)
}))
vi.mock('./TranscriptViewport', async (original) => {
  const module = await original<typeof import('./TranscriptViewport')>()
  return {
    ...module,
    TranscriptViewport: (props: TranscriptViewportProps<ViewportBlockBase>) => {
      lastSnapshot = props.snapshot
      return createElement(module.TranscriptViewport, { ...props, ...viewportOptions })
    }
  }
})

let lastSnapshot: TranscriptViewportProps<ViewportBlockBase>['snapshot'] | undefined
let dom: FakeDom | undefined
let viewportOptions: Pick<TranscriptViewportProps<ViewportBlockBase>, 'overscan'>
afterEach(() => {
  dom?.unmount()
  clearDisclosures('s')
  dom = undefined
  lastSnapshot = undefined
  viewportOptions = {}
  setVirtualization(true)
  portal.mockClear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function mountTranscript(
  backend: Backend,
  agentKind: AgentKind,
  messages: Message[],
  options: {
    layout?: Layout
    isPinned?: () => boolean
    scrollRef?: { current: HTMLDivElement | null }
  } = {}
): () => void {
  installChatStoreHarness({ messages, backend, agentKind })
  dom = installFakeDom({
    innerWidth: 800,
    innerHeight: 500,
    layout: options.layout ?? (() => ({ rect: { top: 0, left: 0, height: 32, width: 600 } }))
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

  const scrollRef = options.scrollRef ?? { current: null }
  const contentRef = { current: null }
  function Screen(): React.JSX.Element {
    const session = useChatStore((state) => state.sessions.s.session)
    return createElement(TranscriptView, {
      agentKind,
      backend,
      messages: session.messages,
      pendingSteer: [],
      inflight: session.inflight,
      loadingSession: session.loadingSession,
      anchored: false,
      scrollRef,
      contentRef,
      isPinned: options.isPinned ?? (() => true),
      onScroll: () => {}
    })
  }

  return () => dom!.render(createElement(Screen))
}

function interactiveScrollRef(): { current: HTMLDivElement | null } {
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

function installCharacterRects(): void {
  const create = document.createRange.bind(document)
  Object.assign(document, {
    createRange: () => {
      const range = create() as Range & { start: { node: FakeNode; offset: number } }
      return Object.assign(range, {
        getBoundingClientRect: () => {
          const { node, offset } = range.start
          const rect = node.getBoundingClientRect()
          return { ...rect, height: 16, top: rect.top + 16 * Math.floor(offset / 8) }
        }
      })
    }
  })
}

function characterTop(node: FakeNode, offset: number): number {
  const range = document.createRange()
  range.setStart(node as unknown as Node, offset)
  range.setEnd(node as unknown as Node, offset + 1)
  return range.getBoundingClientRect().top
}

const screens = [
  ['claude', 'code'],
  ['claude', 'work'],
  ['opencode', 'code']
] as const

describe('TranscriptViewport via the production harnesses', () => {
  it.each(screens)(
    'prunes only after the newest reset across batched changes and session lineages (%s/%s)',
    (backend, agentKind) => {
      const render = mountTranscript(backend, agentKind, [
        { id: 'u:keep', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'keep' }] }
      ])
      render()
      const installBatch = (complete: boolean, appends: number): void => {
        let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: !complete })
        changes = recordChange(changes, { kind: 'reset', complete })
        for (let i = 0; i < appends; i++)
          changes = recordChange(changes, { kind: 'append', ids: ['u:keep'] })
        const current = useChatStore.getState().sessions.s
        useChatStore.setState({
          sessions: {
            s: {
              ...current,
              session: { ...current.session, historyComplete: complete, transcriptChanges: changes }
            }
          }
        })
        render()
      }
      for (const [complete, append] of [
        [true, 1],
        [true, 0],
        [true, 0],
        [false, 1],
        [true, 65],
        [false, 65]
      ] as const) {
        setDisclosure('s', 'deleted', true)
        setDisclosure('s', 'u:keep:user', true)
        installBatch(complete, append)
        expect(getDisclosure('s', 'deleted')).toBe(!complete)
        expect(getDisclosure('s', 'u:keep:user')).toBe(true)
      }
    }
  )

  it.each(screens)(
    '%s %s keeps the reading character and open card across both partial boundary resets without restoring the selection (AC22 · ΔV2 D-102)',
    (backend, agentKind) => {
      vi.useFakeTimers()
      for (const variant of ['previous user', 'missing question']) {
        dom?.unmount()
        const assistant: Message = {
          id: 'a:boundary',
          role: 'assistant',
          createdAt: 3,
          parts: [
            {
              type: 'tool_call',
              toolRunId: 'boundary-read',
              toolName: 'Read',
              args: { file_path: 'file' }
            },
            { type: 'tool_result', toolRunId: 'boundary-read', result: 'ok', isError: false },
            { type: 'text', text: 'reading the same sentence' }
          ]
        }
        const user: Message = {
          id: 'u:boundary',
          role: 'user',
          createdAt: 2,
          parts: [{ type: 'text', text: 'existing question' }]
        }
        const messages = variant === 'previous user' ? [user, assistant] : [assistant]
        const layout: Layout = (node) => {
          const viewport = node.closest('[data-behavior="virtualizable"]')
          const row = node.closest('[data-index]')
          if (!row || !viewport)
            return { rect: { top: 0, left: 0, width: 600, height: 400 }, scrollHeight: 1800 }
          const index = Number(row.getAttribute('data-index'))
          // Two adjacent user bubbles can share one React block; the new bubble still adds height above our sentence.
          const grouped =
            variant === 'previous user' &&
            viewport.querySelector('[data-part-key="u:older:user"]') &&
            index > 0
          const top = 80 * index + (grouped ? 32 : 0) - viewport.scrollTop
          return { rect: { top, left: 0, width: 600, height: 80 } }
        }
        const scrollRef = interactiveScrollRef()
        const render = mountTranscript(backend, agentKind, messages, {
          layout,
          isPinned: () => false,
          scrollRef
        })
        vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
        vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
        const { select, selection } = installViewportSelection(dom!)
        installCharacterRects()
        render()
        vi.advanceTimersByTime(48)
        const card = dom!.query('[data-part-key="a:boundary:tool:boundary-read"]')!
        const toggle = card.querySelector('[aria-expanded]')!
        dom!.click(toggle)
        expect(toggle.getAttribute('aria-expanded')).toBe('true')
        const response = dom!.query('[data-part-key="a:boundary:text:0"]')!
        const blockKey = response.closest('[data-index]')!.getAttribute('data-block-key')
        const viewport = dom!.query('[data-behavior="virtualizable"]')!
        viewport.scrollTop = response.getBoundingClientRect().top + 3
        const oldScroll = viewport.scrollTop
        select(response, 10, response, 2)
        const content = selection.toString()
        const oldPoint = selection.anchorNode!
        const oldTop = characterTop(oldPoint, selection.anchorOffset)
        Object.assign(document, {
          caretPositionFromPoint: () => ({ offsetNode: oldPoint, offset: 10 })
        })
        scrollRef.current!.dispatchEvent(new Event('scroll'))
        selection.removeAllRanges()
        const prefix = variant === 'previous user' ? { ...user, id: 'u:older', createdAt: 1 } : user
        chatActions.prependHistory('s', [prefix], { reachedStart: false })
        render()
        vi.advanceTimersByTime(48)
        const session = useChatStore.getState().sessions.s.session
        expect(session.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })
        expect(session.messages.map((m) => m.id)).toEqual([prefix.id, ...messages.map((m) => m.id)])
        expect(dom!.query('[data-part-key="a:boundary:tool:boundary-read"]')).toBe(card)
        expect(toggle.getAttribute('aria-expanded')).toBe('true')
        const after = dom!.query('[data-part-key="a:boundary:text:0"]')!
        expect(after.closest('[data-index]')!.getAttribute('data-block-key')).toBe(blockKey)
        // ΔV2 D-102: the viewport does not restore a selection the browser dropped.
        expect(content.length).toBeGreaterThan(0)
        expect(selection.rangeCount).toBe(0)
        expect(viewport.scrollTop, variant).toBeGreaterThan(oldScroll)
        let point: FakeNode = after
        while (point.nodeType !== 3) point = point.children[0]
        expect(Math.abs(characterTop(point, 10) - oldTop), variant).toBeLessThanOrEqual(1)
        clearDisclosures('s')
      }
    }
  )

  it('inherits the open Work activity on both sides of a group split (AC22)', async () => {
    vi.useFakeTimers()
    const assistant: Message = {
      id: 'a:split',
      role: 'assistant',
      createdAt: 2,
      parts: [
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'first' } },
        { type: 'tool_call', toolRunId: 'left', toolName: 'Read', args: { file_path: 'left' } },
        { type: 'tool_call', toolRunId: 'right', toolName: 'Read', args: { file_path: 'right' } },
        { type: 'response_boundary', boundary: { phase: 'end', id: 'first', outcome: 'ended' } }
      ]
    }
    const render = mountTranscript('claude', 'work', [assistant])
    vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
    render()
    const [original] = dom!.queryAll('[data-focus-id="activity-toggle"]')
    expect(original.getAttribute('aria-expanded')).toBe('false')
    dom!.click(original)
    expect(original.getAttribute('aria-expanded')).toBe('true')
    const rightTool = '[data-part-key="a:split:tool:right"]'
    const rightToggle = dom!.query(rightTool)!.querySelector('[aria-expanded]')!
    dom!.click(rightToggle)
    expect(rightToggle.getAttribute('aria-expanded')).toBe('true')
    const separated: Message = {
      ...assistant,
      parts: [
        ...assistant.parts.slice(0, 2),
        assistant.parts[3],
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'second' } },
        assistant.parts[2],
        { type: 'response_boundary', boundary: { phase: 'end', id: 'second', outcome: 'ended' } }
      ]
    }
    vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
    vi.spyOn(sessionApi, 'load').mockResolvedValue({
      id: 's',
      backend: 'claude',
      agentKind: 'work',
      title: 'split',
      messages: [separated]
    })
    await chatActions.loadSession('s', null, { revalidate: true })
    render()
    const groups = dom!.queryAll('[data-work-activity]')
    expect(groups).toHaveLength(2)
    expect(
      dom!.query(rightTool)!.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')
    ).toBe('true')
    expect(groups[0].querySelector('[data-focus-id="activity-toggle"]')).toBe(original)
    for (const [index, id] of ['left', 'right'].entries()) {
      expect(
        groups[index]
          .querySelector('[data-focus-id="activity-toggle"]')
          ?.getAttribute('aria-expanded')
      ).toBe('true')
      expect(groups[index].querySelector(`[data-part-key="a:split:tool:${id}"]`)).toBeTruthy()
    }
    const rightKey = groups[1].closest('[data-index]')!.getAttribute('data-block-key')!
    const session = {
      id: 's',
      backend: 'claude' as const,
      agentKind: 'work' as const,
      title: 'split'
    }
    vi.mocked(sessionApi.load).mockResolvedValue({ ...session, messages: [assistant] })
    await chatActions.loadSession('s', null, { revalidate: true })
    render()
    const [merged] = dom!.queryAll('[data-focus-id="activity-toggle"]')
    dom!.click(merged)
    expect(merged.getAttribute('aria-expanded')).toBe('false')
    setDisclosure('s', rightKey, true)
    vi.mocked(sessionApi.load).mockResolvedValue({ ...session, messages: [separated] })
    await chatActions.loadSession('s', null, { revalidate: true })
    render()
    const splitAgain = dom!.queryAll('[data-focus-id="activity-toggle"]')
    expect(splitAgain.map((toggle) => toggle.getAttribute('aria-expanded'))).toEqual([
      'false',
      'false'
    ])
    expect(getDisclosure('s', rightKey, true)).toBe(false)
  })

  it('keeps the visible character and nonzero scroll position when sending after a 5,000-block answer (AC16)', () => {
    vi.useFakeTimers()
    const fixture = generateTranscriptFixture('claude-code', { turns: 1 }, 'answer-5000')
    const scrollRef = interactiveScrollRef()
    const layout: Layout = (node) => {
      const row = node.closest('[data-index]')
      const top = row
        ? 140 * Number(row.getAttribute('data-index')) - (scrollRef.current?.scrollTop ?? 0)
        : 0
      return { rect: { top, left: 0, height: row ? 140 : 400, width: 600 }, scrollHeight: 500000 }
    }
    const render = mountTranscript('claude', 'code', fixture.loadedMessages, {
      scrollRef,
      layout,
      isPinned: () => false
    })
    vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
    const { select, selection } = installViewportSelection(dom!)
    installCharacterRects()
    render()
    vi.advanceTimersByTime(48)
    const answerSnapshot = lastSnapshot!
    expect(answerSnapshot.count).toBeGreaterThanOrEqual(5000)
    const part = dom!.query('[data-part-key="a:fx-0:text:0"]')!
    const key = part.closest('[data-index]')!.getAttribute('data-block-key')
    const viewport = scrollRef.current!
    viewport.scrollTop = 17
    select(part, 10, part, 2)
    const oldScroll = viewport.scrollTop
    const oldCharTop = characterTop(selection.anchorNode!, selection.anchorOffset)
    const oldRange = selection.toString()
    Object.assign(document, {
      caretPositionFromPoint: () => ({ offsetNode: selection.anchorNode, offset: 10 })
    })
    viewport.dispatchEvent(new Event('scroll'))
    render()
    vi.advanceTimersByTime(48)
    const mounted = dom!.queryAll('[data-index]').map((row) => row.getAttribute('data-block-key'))
    expect(viewport.scrollTop).toBe(oldScroll)
    expect(oldScroll).toBeGreaterThan(0)
    expect(mounted.length).toBeLessThan(60)
    const send = vi.spyOn(chatApi, 'send').mockResolvedValue(undefined)
    expect(chatActions.send('after the long answer')).toBe(true)
    render()
    vi.advanceTimersByTime(48)
    expect(send).toHaveBeenCalledOnce()
    const appended = useChatStore.getState().sessions.s.session.messages.at(-1)!
    expect(appended.role).toBe('user')
    expect(answerSnapshot.indexOf(`${appended.id}:user`)).toBe(-1)
    expect(lastSnapshot!.indexOf(`${appended.id}:user`)).toBeGreaterThan(0)
    const after = dom!.query('[data-part-key="a:fx-0:text:0"]')!
    expect(after.closest('[data-index]')!.getAttribute('data-block-key')).toBe(key)
    expect(dom!.queryAll('[data-index]').map((row) => row.getAttribute('data-block-key'))).toEqual(
      mounted
    )
    expect(viewport.scrollTop).toBe(oldScroll)
    expect(selection.toString()).toBe(oldRange)
    expect([selection.anchorOffset, selection.focusOffset]).toEqual([10, 2])
    expect(selection.anchorNode!.closest('[data-part-key]')).toBe(after)
    expect(
      Math.abs(characterTop(selection.anchorNode!, selection.anchorOffset) - oldCharTop)
    ).toBeLessThanOrEqual(1)
  })

  it('updates result panel snapshots only for distinct structured outputs', () => {
    function resultMessage(value: unknown): Message {
      return {
        id: 'a:result',
        createdAt: 1,
        role: 'assistant',
        parts: [
          {
            type: 'tool_result',
            toolRunId: 'tool',
            result: '',
            isError: false,
            structuredOutput: value
          }
        ]
      }
    }
    const initial = new Map([['field', [1, 2]]])
    mountTranscript('claude', 'code', [resultMessage(initial)])
    const snapshots: TranscriptResults[] = []
    function Results(): React.JSX.Element {
      const view = useTranscriptView('transcriptResults')
      snapshots.push(view)
      return createElement('output', {}, [...view.keys()].join(','))
    }
    dom!.render(createElement(Results))
    expect(snapshots.at(-1)!.get('tool')!.structuredOutput).toBe(initial)
    function publish(value: unknown, same: boolean): void {
      const before = snapshots.at(-1)!
      const current = useChatStore.getState().sessions.s
      const changes = recordChange(current.session.transcriptChanges, {
        kind: 'replace',
        id: 'a:result',
        partsFrom: 0
      })
      useChatStore.setState({
        sessions: {
          s: {
            ...current,
            session: {
              ...current.session,
              messages: [resultMessage(value)],
              transcriptChanges: changes
            }
          }
        }
      })
      dom!.render(createElement(Results))
      const after = snapshots.at(-1)!
      expect(after === before).toBe(same)
      expect(after.get('tool')!.structuredOutput).toStrictEqual(value)
    }
    publish(new Map([['field', [1, 2]]]), true)
    publish(new Map([['field', [2, 1]]]), false)
    publish({}, false)
    publish({}, true)
    publish({ left: [1, null] }, false)
    publish({ left: [1, null] }, true)
    publish({ right: [1, null] }, false)
    publish({ right: [1, '1'] }, false)
    expect(snapshots[0].get('tool')!.structuredOutput).toBe(initial)
  })

  it('reads the task board through the production domain hook', () => {
    mountTranscript('claude', 'code', [
      {
        id: 'a:board',
        createdAt: 1,
        role: 'assistant',
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'create',
            toolName: 'TaskCreate',
            args: { subject: 'Review' }
          },
          {
            type: 'tool_result',
            toolRunId: 'create',
            result: 'created',
            isError: false,
            structuredOutput: { task: { id: '1', subject: 'Review' } }
          }
        ]
      }
    ])
    function Board(): React.JSX.Element {
      const board = useTranscriptView('taskBoard')
      return createElement(
        'output',
        { 'data-board': true },
        board.map((item) => item.title).join(',')
      )
    }
    dom!.render(createElement(Board))
    expect(dom!.query('[data-board]')!.textContent).toBe('Review')
  })

  it('opens and closes the inline AgentTaskRow detail with the work presentation policy', () => {
    vi.useFakeTimers()
    mountTranscript('claude', 'code', [])
    const [call] = partsToolCalls([
      { type: 'tool_call', toolRunId: 'child', toolName: 'Agent', args: { description: 'Review' } }
    ])
    dom!.render(
      createElement(AgentTaskRow, { call, transcriptPolicy: agentUiPolicy('work').transcript })
    )
    const row = dom!.query('[aria-expanded]')!
    expect(row.getAttribute('aria-expanded')).toBe('false')
    dom!.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    dom!.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps both source part markers in expanded Claude Work notes before a tool', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    const render = mountTranscript('claude', 'work', [
      {
        id: 'a:notes',
        role: 'assistant',
        createdAt: 0,
        parts: [
          { type: 'response_boundary', boundary: { id: 'notes', phase: 'begin' } },
          {
            type: 'tool_call',
            toolRunId: 'first-read',
            toolName: 'Read',
            args: { file_path: 'b' }
          },
          { type: 'text', text: 'Checking **two ' },
          { type: 'text', text: 'parts**' },
          {
            type: 'tool_call',
            toolRunId: 'read-notes',
            toolName: 'Read',
            args: { file_path: 'a' }
          },
          { type: 'text', text: 'Done.' },
          { type: 'response_boundary', boundary: { id: 'notes', phase: 'end', outcome: 'ended' } }
        ]
      }
    ])
    render()
    const activity = dom!.query('[data-work-activity]')!
    dom!.click(activity.querySelector('[data-focus-id="activity-toggle"]')!)
    const fragments = activity.querySelectorAll('[data-markdown-part-fragment]')
    expect(fragments.map((node) => [node.getAttribute('data-part-key'), node.textContent])).toEqual(
      [
        ['a:notes:text:0', 'Checking '],
        ['a:notes:text:0', 'two '],
        ['a:notes:text:1', 'parts']
      ]
    )
  })

  it.each(screens)(
    '%s %s places open, sync and resume through the store and scroll controller',
    async (backend, agentKind) => {
      vi.useFakeTimers()
      const messages: Message[] = [
        { id: 'u:entry', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'question' }] }
      ]
      mountTranscript(backend, agentKind, messages)
      vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
      vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
      vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
      const loaded = {
        id: 's',
        title: 'entry',
        agentKind,
        backend,
        messages
      }
      let resolveCached!: (value: typeof loaded) => void
      const load = vi.spyOn(sessionApi, 'load').mockResolvedValue(loaded)
      load.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCached = resolve
        })
      )
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
      let generating = false
      const writes: number[] = []
      vi.stubGlobal('Element', class {})
      const listeners = new Map<string, EventListener>()
      let top = 123
      const viewport = {
        dataset: {},
        scrollHeight: 1000,
        scrollTo: vi.fn(),
        clientHeight: 200,
        get scrollTop() {
          return top
        },
        set scrollTop(value: number) {
          top = Math.min(this.scrollHeight - this.clientHeight, value)
          writes.push(top)
        },
        getBoundingClientRect: () => ({ top: 0, bottom: 200 }),
        querySelectorAll: () => [],
        addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
        removeEventListener: (type: string) => listeners.delete(type)
      }
      const state = timelineViewState('s')
      state.setPinned(false)
      state.setTop(321)
      const content = {} as HTMLDivElement
      let mounted!: ScrollAnchor
      const attach = (scroll: ScrollAnchor): null => {
        mounted = scroll
        scroll.scrollRef.current = viewport as unknown as HTMLDivElement
        scroll.contentRef.current = content
        return null
      }
      const renderController = (sendCount?: number): void => {
        const session = useChatStore.getState().sessions.s.session
        const controllerProps = {
          backend,
          sessionId: 's',
          sessionKey: 's',
          sendCount: sendCount ?? session.sendCount,
          inflight: generating,
          messages: session.messages,
          children: attach
        }
        dom!.render(createElement(HarnessScrollController, controllerProps))
      }

      useChatStore.setState({ activeKey: 'other' })
      const pendingCached = chatActions.loadSession('s')
      expect(useChatStore.getState().entryIntent?.cause).toBe('open')
      renderController()
      expect(top).toBe(800)
      expect(useChatStore.getState().entryIntent).toBeNull()

      writes.length = 0
      resolveCached(loaded)
      await pendingCached
      renderController()
      expect(mounted.isPinned()).toBe(true)
      expect(top).toBe(800)
      expect(writes).toEqual([])
      expect(useChatStore.getState().entryIntent).toBeNull()

      for (const active of [false, true]) {
        generating = active
        renderController()
        mounted.scrollToBottom()
        writes.length = 0
        viewport.scrollHeight += 40
        observers.get(content)!([], {} as ResizeObserver)
        vi.advanceTimersByTime(32)
        const follows = backend === 'opencode' || generating
        expect(writes).toEqual(follows ? [viewport.scrollHeight - viewport.clientHeight] : [])
      }
      for (const event of [
        { type: 'wheel', deltaY: -1 },
        { type: 'keydown', key: 'PageUp' },
        { type: 'keydown', key: 'Home' },
        { type: 'keydown', key: 'ArrowUp' }
      ]) {
        viewport.scrollHeight = viewport.clientHeight
        mounted.scrollToBottom()
        expect(top).toBe(0)
        const listener = listeners.get(event.type)
        expect(listener).toBeDefined()
        listener!(Object.assign(new Event(event.type), { deltaY: event.deltaY, key: event.key }))
        expect(mounted.isPinned()).toBe(false)
        writes.length = 0
        viewport.scrollHeight += 80
        observers.get(content)!([], {} as ResizeObserver)
        vi.advanceTimersByTime(32)
        expect(top).toBe(0)
        expect(writes).toEqual([])
      }
      generating = false
      viewport.scrollHeight = 1000
      renderController()
      mounted.scrollToBottom()
      listeners.get('wheel')!({ type: 'wheel', deltaY: 1 } as WheelEvent)
      listeners.get('keydown')!({ type: 'keydown', key: 'ArrowDown' } as KeyboardEvent)
      expect(mounted.isPinned()).toBe(true)

      top = 217
      writes.length = 0
      state.setAnchor({ key: 'u:entry:user', offset: -17 })
      const savedAnchor = state.anchor
      const beforeReselect = load.mock.calls.length
      await chatActions.loadSession('s')
      renderController()
      expect(load).toHaveBeenCalledTimes(beforeReselect)
      expect(top).toBe(217)
      expect(state.anchor).toBe(savedAnchor)
      expect(useChatStore.getState().entryIntent).toBeNull()
      expect(writes).toEqual([])
      await chatActions.loadSession('s', null, { revalidate: true })
      renderController()
      expect(writes).toEqual([])
      expect(top).toBe(217)

      dom!.unmount()
      state.setPinned(false)
      state.setTop(321)
      top = 0
      renderController()
      expect(top).toBe(backend === 'opencode' ? 321 : 800)
      if (backend === 'claude') {
        top = 123
        vi.spyOn(chatApi, 'send').mockResolvedValue(undefined)
        expect(chatActions.send('follow up')).toBe(true)
        renderController()
        expect(viewport.scrollTo.mock.calls).toEqual([[{ top: 1000, behavior: 'smooth' }]])
        generating = true
        renderController()
        expect(viewport.scrollTo).toHaveBeenCalledOnce()
        top = 799
        renderController(useChatStore.getState().sessions.s.session.sendCount + 1)
        expect(viewport.scrollTo).toHaveBeenCalledOnce()
      }
      dom!.unmount()
      state.setPinned(true)
      state.setTop(0)
      state.setAnchor(null)
    }
  )

  it.each(screens)(
    '%s %s retains the open tool card instance and selection through a real cached reload, then cancels the selection when the next question row mounts (ΔV2 D-103)',
    async (backend, agentKind) => {
      vi.useFakeTimers()
      vi.stubGlobal('requestAnimationFrame', vi.fn())
      const messages: Message[] = [
        {
          id: 'a:cached',
          role: 'assistant',
          createdAt: 0,
          parts: [
            {
              type: 'tool_call',
              toolRunId: 'cached-read',
              toolName: 'Read',
              args: { file_path: 'readme.md' }
            },
            {
              type: 'tool_result',
              toolRunId: 'cached-read',
              result: 'file content here',
              isError: false
            },
            { type: 'text', text: 'after reading the file' }
          ]
        }
      ]
      viewportOptions = { overscan: 8 }
      const render = mountTranscript(backend, agentKind, messages)
      const { select, selection } = installViewportSelection(dom!)
      render()
      const card = dom!.query('[data-part-key="a:cached:tool:cached-read"]')!
      const toggle = card.querySelector('[aria-expanded]')!
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      dom!.click(toggle)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      const response = dom!.query('[data-part-key="a:cached:text:0"]')!
      select(response, 10, response, 2)
      const content = selection.toString()
      vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
      vi.spyOn(sessionApi, 'load').mockResolvedValue({
        id: 's',
        backend,
        agentKind,
        title: 'cached',
        messages: structuredClone(messages)
      })
      await chatActions.loadSession('s', null, { revalidate: true })
      render()
      expect(dom!.query('[data-part-key="a:cached:tool:cached-read"]')).toBe(card)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(selection.toString()).toBe(content)
      useChatStore.setState({ activeKey: 'different-session' })
      await chatActions.loadSession('s')
      render()
      expect(useChatStore.getState().activeKey).toBe('s')
      expect(dom!.query('[data-part-key="a:cached:tool:cached-read"]')).toBe(card)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(selection.toString()).toBe(content)

      const send = vi.spyOn(chatApi, 'send').mockResolvedValue(undefined)
      expect(chatActions.send('next question')).toBe(true)
      render()
      expect(send).toHaveBeenCalledOnce()
      expect(useChatStore.getState().sessions.s.session.messages.at(-1)?.role).toBe('user')
      expect(dom!.query('[data-part-key="a:cached:tool:cached-read"]')).toBe(card)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(selection.toString()).toBe('')
      expect(selection.rangeCount).toBe(0)
    }
  )
})
