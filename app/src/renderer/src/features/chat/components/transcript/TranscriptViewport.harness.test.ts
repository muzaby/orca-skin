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
import * as errors from '../../../../shared/errors/reportError'
import type { Backend } from '../../../../../../shared/ipc'
import type { AgentKind } from '../../../../../../shared/agent-kind'
import type { Message } from '../../reducer/chatReducer'
import { chatActions, useChatStore, useTranscriptView } from '../../store/chatStore'
import { clearDisclosures, setDisclosure, getDisclosure } from '../../store/disclosureStore'
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
import type { CopyTaskTiming } from '../../lib/transcript/viewport/copy'

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
let viewportOptions: Pick<
  TranscriptViewportProps<ViewportBlockBase>,
  'overscan' | 'copyChunkSize' | 'onCopyTiming'
>
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
        let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete })
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
    '%s %s keeps the reading character, selection and open card across both partial boundary resets (AC22)',
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
        expect(selection.toString()).toBe(content)
        expect([
          selection.anchorNode!.closest('[data-part-key]')!.getAttribute('data-part-key'),
          selection.anchorOffset,
          selection.focusNode!.closest('[data-part-key]')!.getAttribute('data-part-key'),
          selection.focusOffset
        ]).toEqual(['a:boundary:text:0', 10, 'a:boundary:text:0', 2])
        expect(viewport.scrollTop, variant).toBeGreaterThan(oldScroll)
        expect(
          Math.abs(characterTop(selection.anchorNode!, selection.anchorOffset) - oldTop),
          variant
        ).toBeLessThanOrEqual(1)
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
    expect(dom!.query('[data-part-key="a:split:tool:right"]')).toBeTruthy()
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
    expect(groups[0].querySelector('[data-focus-id="activity-toggle"]')).toBe(original)
    for (const [index, id] of ['left', 'right'].entries()) {
      expect(
        groups[index]
          .querySelector('[data-focus-id="activity-toggle"]')
          ?.getAttribute('aria-expanded')
      ).toBe('true')
      expect(groups[index].querySelector(`[data-part-key="a:split:tool:${id}"]`)).toBeTruthy()
    }
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

  it('retains the keyboard-extended endpoint before the next selectionchange', () => {
    const render = mountTranscript('claude', 'code', [
      { id: 'u:key', role: 'user', createdAt: 2, parts: [{ type: 'text', text: 'question' }] },
      { id: 'a:key', role: 'assistant', createdAt: 3, parts: [{ type: 'text', text: 'answer' }] }
    ])
    const { select, selection } = installViewportSelection(dom!)
    render()
    const user = dom!.query('[data-part-key="u:key:user"]')!
    const answer = dom!.query('[data-part-key="a:key:text:0"]')!
    select(answer, 2, user, 1)
    selection.setBaseAndExtent(selection.anchorNode!, 5, selection.focusNode!, 3)
    const onKeyDown = dom!.query('[data-transcript-viewport]')!.props.onKeyDown as (e: {
      shiftKey: boolean
      key: string
    }) => void
    dom!.act(() => onKeyDown({ shiftKey: true, key: 'ArrowLeft' }))
    selection.removeAllRanges()
    dom!.act(() =>
      chatActions.prependHistory(
        's',
        [
          { id: 'u:old', role: 'user', createdAt: 0, parts: [{ type: 'text', text: 'earlier' }] },
          {
            id: 'a:old',
            role: 'assistant',
            createdAt: 1,
            parts: [{ type: 'text', text: 'history' }]
          }
        ],
        { reachedStart: true }
      )
    )
    expect([selection.anchorOffset, selection.focusOffset]).toEqual([5, 3])
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
      vi.spyOn(sessionApi, 'load').mockResolvedValue({
        id: 's',
        title: 'entry',
        agentKind,
        backend,
        messages
      })
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
          top = Math.min(800, value)
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
      const renderController = (): void => {
        const session = useChatStore.getState().sessions.s.session
        const controllerProps = {
          backend,
          sessionId: 's',
          sessionKey: 's',
          sendCount: session.sendCount,
          inflight: false,
          messages: session.messages,
          children: attach
        }
        dom!.render(createElement(HarnessScrollController, controllerProps))
      }

      useChatStore.setState({ activeKey: 'other' })
      await chatActions.loadSession('s')
      expect(useChatStore.getState().entryIntent?.cause).toBe('open')
      renderController()
      expect(top).toBe(800)
      expect(useChatStore.getState().entryIntent).toBeNull()

      for (const event of [
        { type: 'wheel', deltaY: -1 },
        { type: 'keydown', key: 'PageUp' },
        { type: 'keydown', key: 'Home' },
        { type: 'keydown', key: 'ArrowUp' }
      ]) {
        mounted.scrollToBottom()
        const listener = listeners.get(event.type)
        expect(listener).toBeDefined()
        listener!(Object.assign(new Event(event.type), { deltaY: event.deltaY, key: event.key }))
        expect(mounted.isPinned()).toBe(false)
      }
      mounted.scrollToBottom()
      listeners.get('wheel')!({ type: 'wheel', deltaY: 1 } as WheelEvent)
      listeners.get('keydown')!({ type: 'keydown', key: 'ArrowDown' } as KeyboardEvent)
      expect(mounted.isPinned()).toBe(true)

      top = 217
      writes.length = 0
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
      }
      dom!.unmount()
      state.setPinned(true)
      state.setTop(0)
    }
  )

  it.each(screens)(
    '%s %s runs bounded and chunked copy on the same rendered selection',
    async (backend, agentKind) => {
      vi.useFakeTimers()
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 0)
      )
      const messages: Message[] = Array.from({ length: 12 }, (_, index) => ({
        id: `${index % 2 ? 'a' : 'u'}:copy-${index}`,
        role: index % 2 ? 'assistant' : 'user',
        createdAt: index,
        parts:
          index % 2
            ? [
                { type: 'text', text: 'plain **body ' },
                { type: 'text', text: `${index}** and ` + '`code`' }
              ]
            : [{ type: 'text', text: `question ${index}` }]
      }))
      messages[1] = {
        ...messages[1],
        parts: [
          ...messages[1].parts,
          ...['opened', 'collapsed'].flatMap((state): Message['parts'] => [
            {
              type: 'tool_call',
              toolRunId: `c9-${state}`,
              toolName: 'Read',
              args: { file_path: `${state}.md` }
            },
            {
              type: 'tool_result',
              toolRunId: `c9-${state}`,
              result: `content-${state}-c9`,
              isError: false
            }
          ])
        ]
      }
      const render = mountTranscript(backend, agentKind, messages)
      const { selection, select } = installViewportSelection(dom!)
      const write = vi
        .fn<(items: Record<string, Blob>[]) => Promise<void>>()
        .mockResolvedValue(undefined)
      const nativeBlob = Blob
      const plainParts: BlobPart[][] = []
      vi.stubGlobal(
        'Blob',
        class extends nativeBlob {
          constructor(parts: BlobPart[], options: BlobPropertyBag) {
            super(parts, options)
            if (options.type === 'text/plain') plainParts.push(parts)
          }
        }
      )
      vi.stubGlobal('navigator', { clipboard: { write } })
      vi.stubGlobal(
        'ClipboardItem',
        class {
          constructor(items: Record<string, Blob>) {
            Object.assign(this, items)
          }
        }
      )
      const start = (): FakeNode => dom!.query('[data-part-key="u:copy-0:user"]')!
      const end = (): FakeNode => dom!.queryAll('[data-part-key="a:copy-3:text:1"]').at(-1)!
      const middle = (): FakeNode | null => dom!.query('[data-part-key="u:copy-2:user"]')

      setVirtualization(false)
      viewportOptions = { overscan: 20, copyChunkSize: 30 }
      render()
      const contextGroup = dom!
        .query('[data-component="context-tool-group"]')
        ?.querySelector('[aria-expanded]')
      if (contextGroup?.getAttribute('aria-expanded') === 'false') dom!.click(contextGroup)
      const cardToggle = (state: string): FakeNode =>
        dom!.query(`[data-part-key="a:copy-1:tool:c9-${state}"]`)!.querySelector('[aria-expanded]')!
      const open = cardToggle('opened')
      if (open.getAttribute('aria-expanded') === 'false') dom!.click(open)
      expect(cardToggle('opened').getAttribute('aria-expanded')).toBe('true')
      expect(cardToggle('collapsed').getAttribute('aria-expanded')).toBe('false')
      select(end(), 3, start(), 2)
      // The non-virtual reference leaves the copy event entirely to the browser.
      expect(dom!.query('[data-transcript-viewport]')!.props.onCopy).toBeUndefined()
      const reference = selection.toString()
      expect(reference).toContain('content-opened-c9')
      expect(reference).not.toContain('content-collapsed-c9')
      expect(reference.split('\n').length).toBeGreaterThan(2)

      setVirtualization(true)
      render()
      select(end(), 3, start(), 2)
      viewportOptions = { ...viewportOptions, overscan: 0 }
      render()
      expect(middle()).toBeNull()
      const invokeCopy = (): ReturnType<typeof vi.fn> => {
        const preventDefault = vi.fn()
        const viewport = dom!.query('[data-transcript-viewport]')!
        const onCopy = viewport.props.onCopy as (event: { preventDefault: () => void }) => void
        dom!.act(() => onCopy({ preventDefault }))
        return preventDefault
      }

      expect(invokeCopy()).not.toHaveBeenCalled()
      expect(middle()).not.toBeNull()
      expect(selection.toString()).toBe(reference)
      await vi.runAllTimersAsync()
      dom!.act(() => {})
      expect(middle()).toBeNull()

      const timings: CopyTaskTiming[] = []
      viewportOptions = {
        ...viewportOptions,
        copyChunkSize: 2,
        onCopyTiming: (timing) => {
          timings.push(timing)
        }
      }
      render()
      expect(invokeCopy()).toHaveBeenCalledOnce()
      expect(write).not.toHaveBeenCalled()
      await vi.runAllTimersAsync()
      expect(write).toHaveBeenCalledOnce()
      expect(portal).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ style: { width: '600px' } }) }),
        document.body
      )
      const mime = write.mock.calls[0][0][0]
      expect(mime['text/plain'].type).toBe('text/plain')
      expect(mime['text/html'].type).toBe('text/html')
      expect((await mime['text/html'].text()).length).toBeGreaterThan(0)
      expect(await write.mock.calls[0][0][0]['text/plain'].text()).toBe(reference)
      expect(plainParts[0].length).toBeGreaterThan(1)
      expect(
        timings.filter(({ kind }) => kind === 'chunk').every(({ blockCount }) => blockCount <= 2)
      ).toBe(true)
      expect(dom!.query('[data-copy-serialization-host]')).toBeNull()
      expect(selection.anchorOffset).toBe(3)
      expect(selection.focusOffset).toBe(2)

      const report = vi.spyOn(errors, 'reportError').mockImplementation(() => {})
      vi.spyOn(document, 'createRange').mockImplementation(() => {
        throw new Error('copy range failed')
      })
      write.mockClear()
      timings.length = 0
      expect(invokeCopy()).toHaveBeenCalledOnce()
      await vi.runAllTimersAsync()
      expect(write).not.toHaveBeenCalled()
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'clipboard.copy.failed' })
      )
      expect(dom!.query('[data-copy-serialization-host]')).toBeNull()
      expect(selection.anchorOffset).toBe(3)
      expect(selection.focusOffset).toBe(2)
    }
  )

  it.each(screens)(
    '%s %s retains the open tool card instance and selection through a real cached reload',
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
      // The browser may clear its native Range while React commits the new turn.
      // Keep the viewport's retained (part, offset) endpoints through that commit.
      selection.removeAllRanges()
      expect(chatActions.send('next question')).toBe(true)
      render()
      expect(send).toHaveBeenCalledOnce()
      expect(useChatStore.getState().sessions.s.session.messages.at(-1)?.role).toBe('user')
      expect(dom!.query('[data-part-key="a:cached:tool:cached-read"]')).toBe(card)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(selection.toString()).toBe(content)
      expect([selection.anchorOffset, selection.focusOffset]).toEqual([10, 2])
    }
  )
})
