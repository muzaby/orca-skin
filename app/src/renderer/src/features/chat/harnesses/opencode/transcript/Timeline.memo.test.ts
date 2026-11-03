import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { initialChatState, type Message } from '../../../reducer/chatReducer'
import * as projection from './projection'
import * as turns from '../../../lib/turns'
import { OpenCodeTimeline, OpenCodeTimelineRow } from './Timeline'
import { withTranscript } from '../../registries/transcript.testfixture'
import type { FakeNode } from '../../../../../shared/ui/renderHarness.testfixture'
const live = vi.hoisted(() => ({ text: '', reasoning: '' }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' }),
  formatTimeFull: () => 'time',
  formatTimeShort: () => 'time'
}))
vi.mock('../../../store/chatStore', () => ({
  useLiveText: () => live.text,
  useLiveReasoning: () => live.reasoning,
  useChatSession: (select: (state: typeof initialChatState) => unknown) => select(initialChatState)
}))
vi.mock('../../../components/transcript/PendingAssistantStatus', () => ({
  PendingAssistantStatus: () => null
}))
vi.mock('./scrollContext', () => ({ useTimelineScroll: () => undefined }))
vi.mock('@tanstack/react-virtual', () => ({
  defaultRangeExtractor: () => [],
  useVirtualizer: () => ({ getTotalSize: () => 0, getVirtualItems: () => [] })
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('projects the committed head once and the live tail six times without computing copy text', () => {
  const head = vi.spyOn(projection, 'projectTimelineHead'),
    tail = vi.spyOn(projection, 'projectTimelineTail'),
    copy = vi.spyOn(turns, 'turnCopyText')
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  const messages = [
    {
      role: 'user' as const,
      createdAt: 1,
      parts: [{ type: 'text' as const, text: 'old question' }]
    },
    {
      role: 'assistant' as const,
      createdAt: 2,
      parts: [{ type: 'text' as const, text: 'old answer' }]
    },
    {
      role: 'user' as const,
      createdAt: 3,
      parts: [{ type: 'text' as const, text: 'new question' }]
    }
  ]
  const props = {
    textScaleClassName: '',
    showAutomaticFeeds: false,
    agentKind: 'code' as const,
    messages,
    inflight: true,
    pendingSteer: [],
    loadingSession: false,
    anchored: true,
    scrollRef: { current: null },
    contentRef: { current: null },
    onScroll: () => {}
  }
  try {
    dom.render(createElement(OpenCodeTimeline, props))
    for (const text of ['1', '12', '123', '1234', '12345']) {
      live.text = text
      live.reasoning = `thought ${text}`
      dom.render(createElement(OpenCodeTimeline, props))
    }
    expect(head).toHaveBeenCalledOnce()
    expect(tail).toHaveBeenCalledTimes(6)
    expect(tail.mock.calls.at(-1)?.[1]).toMatchObject({
      text: '12345',
      reasoning: 'thought 12345',
      pending: true
    })
    expect(copy).not.toHaveBeenCalled()
  } finally {
    dom.unmount()
  }
})

it.each([
  { order: 'tools then body', textAt: 1, count: 1 },
  { order: 'body then tools', textAt: 0, count: 1 },
  { order: 'tools only', textAt: -1, count: 0 }
])(
  'renders one turn copy control only when any assistant message has body text: $order',
  ({ textAt, count }) => {
    const messages: Message[] = [0, 1].map((index) => ({
      role: 'assistant',
      createdAt: index + 1,
      parts:
        index === textAt
          ? [{ type: 'text', text: 'copy this answer' }]
          : [{ type: 'tool_call', toolRunId: `read-${index}`, toolName: 'Read', args: {} }]
    }))
    const head = projection.projectTimelineHead(messages)
    const metas = [
      ...head.rows,
      ...projection.projectTimelineTail(head, { text: '', reasoning: '', pending: false })
    ].filter((row) => row.kind === 'meta')
    expect(metas).toHaveLength(1)
    const row = metas[0]
    if (row.kind !== 'meta') throw new Error('missing meta')
    expect(row.turn.messages).toEqual(messages)
    const dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
    try {
      dom.render(withTranscript(createElement(OpenCodeTimelineRow, { row }), 'opencode'))
      const buttons = (node: FakeNode): FakeNode[] => [
        ...(node.tag === 'button' ? [node] : []),
        ...node.children.flatMap(buttons)
      ]
      expect(buttons(dom.body)).toHaveLength(count)
    } finally {
      dom.unmount()
    }
  }
)

it.each([
  [{ type: 'text', text: '   ' }, 0],
  [{ type: 'text', text: 'child only', parentToolRunId: 'child' }, 0],
  [{ type: 'text', text: 'empty child identifier', parentToolRunId: '' }, 0],
  [{ type: 'text', text: 'ordinary body' }, 1]
] as const)('renders exactly the copy controls justified by the meta text: %j', (part, count) => {
  const head = projection.projectTimelineHead([{ role: 'assistant', createdAt: 1, parts: [part] }])
  const rows = [
    ...head.rows,
    ...projection.projectTimelineTail(head, { text: '', reasoning: '', pending: false })
  ]
  const row = rows.find((value) => value.kind === 'meta')!
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  try {
    dom.render(withTranscript(createElement(OpenCodeTimelineRow, { row }), 'opencode'))
    const buttons = (node: FakeNode): FakeNode[] => [
      ...(node.tag === 'button' ? [node] : []),
      ...node.children.flatMap(buttons)
    ]
    expect(buttons(dom.body)).toHaveLength(count)
  } finally {
    dom.unmount()
  }
})
