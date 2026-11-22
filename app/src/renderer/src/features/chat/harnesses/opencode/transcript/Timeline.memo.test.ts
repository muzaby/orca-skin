import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { initialChatState, type Message } from '../../../reducer/chatReducer'
import { newTranscriptChanges } from '../../../lib/transcript/changeLog'
import { OpenCodeTimeline } from './Timeline'
import { withTranscript } from '../../registries/transcript.testfixture'

const live = vi.hoisted(() => ({ text: '', reasoning: '', reasoningVisible: false }))
const virtual = vi.hoisted(() => ({ visible: 0, rangeExtractor: undefined as unknown }))
const liveHooks = vi.hoisted(() => ({
  useLiveText: undefined as unknown as ReturnType<typeof import('vitest').vi.fn>,
  useLiveReasoning: undefined as unknown as ReturnType<typeof import('vitest').vi.fn>
}))
const scroll = vi.hoisted(() => ({ enabled: false }))
const steer = vi.hoisted(() => ({ props: undefined as unknown }))
const changesRef = vi.hoisted(() => ({
  value: { lineage: {}, revision: 0, log: [] } as ReturnType<typeof newTranscriptChanges>
}))

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' }),
  formatTimeFull: () => 'time',
  formatTimeShort: () => 'time'
}))
vi.mock('../../../store/chatStore', async () => {
  const { vi } = await import('vitest')
  liveHooks.useLiveText = vi.fn(() => live.text)
  liveHooks.useLiveReasoning = vi.fn(() => live.reasoning)
  return {
    useLiveText: liveHooks.useLiveText,
    useLiveReasoning: liveHooks.useLiveReasoning,
    useHasLiveText: () => live.text !== '',
    useHasLiveReasoning: () => live.reasoningVisible,
    useLiveTextFor: (enabled: boolean) => (enabled ? live.text : ''),
    useLiveTextKey: () => null,
    useActiveSessionKey: () => 's1',
    useTranscriptChanges: () => changesRef.value,
    useEntryIntent: () => null,
    useChatStore: (select: (state: unknown) => unknown) =>
      select({
        activeKey: 's1',
        entryIntent: null,
        sessions: {
          s1: {
            session: initialChatState,
            live: {
              text: live.text,
              reasoning: live.reasoning,
              reasoningVisible: live.reasoningVisible
            },
            subagentMeta: {}
          }
        }
      }),
    chatActions: { consumeEntryIntent: vi.fn() },
    useChatSession: (select: (state: typeof initialChatState) => unknown) =>
      select(initialChatState)
  }
})
vi.mock('../../common/transcript/UserTurn', async () => {
  const { createElement } = await import('react')
  return { UserTurn: () => createElement('div', { 'data-user-turn': '' }) }
})
vi.mock('../../common/transcript/PendingSteerTurn', () => ({
  PendingSteerTurn: (props: unknown) => {
    steer.props = props
    return null
  }
}))
vi.mock('./Text', async () => {
  const { createElement } = await import('react')
  const Text = ({ source, streaming }: { source: string; streaming: boolean }): React.JSX.Element =>
    createElement('span', { 'data-markdown-mode': streaming ? 'streaming' : 'complete' }, source)
  return { OpenCodeText: Text }
})
vi.mock('../../../components/transcript/PendingAssistantStatus', () => ({
  PendingAssistantStatus: () => null
}))
vi.mock('./scrollContext', async () => {
  const { TimelineViewState } = await import('./viewState')
  const state = new TimelineViewState()
  return {
    useTimelineScroll: () => (scroll.enabled ? { state } : undefined)
  }
})
vi.mock('@tanstack/react-virtual', () => ({
  defaultRangeExtractor: () => [],
  useVirtualizer: (options: {
    count: number
    getItemKey: (index: number) => string
    estimateSize: (index: number) => number
    rangeExtractor: unknown
  }) => {
    virtual.rangeExtractor = options.rangeExtractor
    const first = Math.max(0, options.count - virtual.visible)
    const indexes = Array.from({ length: options.count - first }, (_, offset) => first + offset)
    for (const index of indexes) {
      options.getItemKey(index)
      options.estimateSize(index)
    }
    return {
      getTotalSize: () => 0,
      getVirtualItems: () => indexes.map((index) => ({ index, start: 0 })),
      measureElement: () => {}
    }
  }
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.assign(live, { text: '', reasoning: '', reasoningVisible: false })
  virtual.visible = 0
  scroll.enabled = false
  changesRef.value = newTranscriptChanges()
})

const timelineProps = (messages: Message[]): Parameters<typeof OpenCodeTimeline>[0] => ({
  messages,
  inflight: true,
  pendingSteer: [],
  loadingSession: false,
  anchored: true,
  error: undefined,
  textScaleClassName: '',
  showAutomaticFeeds: false,
  agentKind: 'code' as const,
  scrollRef: { current: null },
  contentRef: { current: null },
  onScroll: () => {}
})

function history(past: number, current: number): { messages: Message[]; partReads: () => number } {
  let reads = 0
  const messages: Message[] = []
  for (let index = 0; index < past; index++) {
    messages.push({
      id: `u:${index}`,
      role: 'user',
      createdAt: index * 2 + 1,
      parts: [{ type: 'text', text: `q${index}` }]
    })
    messages.push({
      id: `a:${index}`,
      role: 'assistant',
      createdAt: index * 2 + 2,
      parts: [{ type: 'text', text: `a${index}` }]
    })
  }
  messages.push({
    id: 'u:now',
    role: 'user',
    createdAt: past * 2 + 1,
    parts: [{ type: 'text', text: 'now' }]
  })
  for (let index = 0; index < current; index++) {
    const parts: Message['parts'] = [{ type: 'text', text: '' }]
    const message = {
      id: `a:cur-${index}`,
      role: 'assistant',
      createdAt: past * 2 + 2 + index
    } as Message
    Object.defineProperty(message, 'parts', {
      enumerable: true,
      get: () => {
        reads++
        return parts
      }
    })
    messages.push(message)
  }
  return { messages, partReads: () => reads }
}

it.each([
  [100, 10],
  [1_000, 100],
  [10_000, 1_000],
  [10_000, 10]
])(
  're-renders only the live leaf for presence-preserving deltas once the live row exists, at every history size (%i past, %i current)',
  (past, current) => {
    const { messages, partReads } = history(past, current)
    const props = timelineProps(messages)
    virtual.visible = 2
    const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    try {
      const render = (): void =>
        dom.render(withTranscript(createElement(OpenCodeTimeline, props), 'opencode'))
      render()
      Object.assign(live, { text: '1', reasoning: 'r', reasoningVisible: true })
      render()
      liveHooks.useLiveText.mockClear()
      liveHooks.useLiveReasoning.mockClear()
      const before = partReads()
      const deltas = [
        { text: '12' },
        { reasoning: 'r x' },
        { reasoning: 'r x   ' },
        { text: '123' },
        { text: '1234' },
        { text: '12345' }
      ]
      for (const delta of deltas) {
        Object.assign(live, delta)
        render()
      }
      expect(partReads() - before).toBe(0)
      expect(liveHooks.useLiveText).not.toHaveBeenCalled()
      expect(liveHooks.useLiveReasoning).not.toHaveBeenCalled()
      const texts = dom.body
        .querySelectorAll('[data-markdown-mode]')
        .map((node) => node.textContent)
      expect(texts.at(-1)).toBe('12345')
    } finally {
      dom.unmount()
    }
  }
)

it('passes the steer-restore callback through to the pending steer bubble', () => {
  const restore = vi.fn()
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  try {
    dom.render(
      withTranscript(
        createElement(OpenCodeTimeline, {
          ...timelineProps([]),
          inflight: false,
          pendingSteer: [{ id: 'p1', text: '대기', submitted: false } as never],
          onRestoreSteerDraft: restore
        }),
        'opencode'
      )
    )
    expect((steer.props as { onRestoreDraft?: unknown }).onRestoreDraft).toBe(restore)
  } finally {
    dom.unmount()
  }
})
