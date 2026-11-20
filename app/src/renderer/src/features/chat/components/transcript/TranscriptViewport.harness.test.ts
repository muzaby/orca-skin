import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { chatApi, sessionApi, settingsApi } from '../../../../shared/api/ipc'
import * as errors from '../../../../shared/errors/reportError'
import type { Backend } from '../../../../../../shared/ipc'
import type { AgentKind } from '../../../../../../shared/agent-kind'
import type { Message } from '../../reducer/chatReducer'
import { chatActions, useChatStore } from '../../store/chatStore'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'
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
    TranscriptViewport: (props: TranscriptViewportProps<ViewportBlockBase>) =>
      createElement(module.TranscriptViewport, { ...props, ...viewportOptions })
  }
})

let dom: FakeDom | undefined
let viewportOptions: Pick<
  TranscriptViewportProps<ViewportBlockBase>,
  'overscan' | 'copyChunkSize' | 'onCopyTiming'
>
afterEach(() => {
  dom?.unmount()
  dom = undefined
  viewportOptions = {}
  setVirtualization(true)
  portal.mockClear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function mountTranscript(backend: Backend, agentKind: AgentKind, messages: Message[]): () => void {
  installChatStoreHarness({ messages, backend, agentKind })
  dom = installFakeDom({
    innerWidth: 800,
    innerHeight: 500,
    layout: () => ({ rect: { top: 0, left: 0, height: 32, width: 600 } })
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

  const scrollRef = { current: null }
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
      isPinned: () => true,
      onScroll: () => {}
    })
  }

  return () => dom!.render(createElement(Screen))
}

const screens = [
  ['claude', 'code'],
  ['claude', 'work'],
  ['opencode', 'code']
] as const

describe('TranscriptViewport via the production harnesses', () => {
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
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
      const state = timelineViewState('s')
      state.setPinned(false)
      state.setTop(321)
      const content = {} as HTMLDivElement
      const attach = (scroll: ScrollAnchor): null => {
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
      select(end(), 3, start(), 2)
      // The non-virtual reference leaves the copy event entirely to the browser.
      expect(dom!.query('[data-transcript-viewport]')!.props.onCopy).toBeUndefined()
      const reference = selection.toString()
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
      expect(portal).toHaveBeenCalledWith(expect.anything(), document.body)
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
