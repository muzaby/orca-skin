import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { initialChatState, type Message } from '../../../reducer/chatReducer'
import * as projection from './projection'
import * as turns from '../../../lib/turns'
import { OpenCodeTimeline, OpenCodeTimelineRow } from './Timeline'
import { withTranscript } from '../../registries/transcript.testfixture'
import type { FakeDom, FakeNode } from '../../../../../shared/ui/renderHarness.testfixture'
const live = vi.hoisted(() => ({ text: '', reasoning: '', reasoningVisible: false }))
// 가상화 흉내 — 마지막 `visible` 개 행을 가시 범위로 삼아 `getItemKey`·`estimateSize` 를 부른다(0325 VP-06).
const virtual = vi.hoisted(() => ({ visible: 0, rangeExtractor: undefined as unknown }))
const liveHooks = vi.hoisted(() => ({
  useLiveText: undefined as unknown as ReturnType<typeof import('vitest').vi.fn>,
  useLiveReasoning: undefined as unknown as ReturnType<typeof import('vitest').vi.fn>
}))
const scroll = vi.hoisted(() => ({ retained: [] as string[], enabled: false }))
const steer = vi.hoisted(() => ({ props: undefined as unknown }))
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
    useChatSession: (select: (state: typeof initialChatState) => unknown) =>
      select(initialChatState)
  }
})
// 사용자 버블 본문은 이 oracle 밖이다(`useId` 를 fake 훅이 흉내 내지 않는다) — 행 껍데기는 Timeline 이 그린다.
vi.mock('../../common/transcript/UserTurn', async () => {
  const { createElement } = await import('react')
  return { UserTurn: () => createElement('div', { 'data-user-turn': '' }) }
})
// steer 대기 버블은 받은 props 만 기록한다(0325 EP-3b ④).
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
    useTimelineScroll: () => (scroll.enabled ? { state, retained: scroll.retained } : undefined)
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
  scroll.retained = []
})
// 0324 의 "tail 6회" 는 0325 D-015 에서 "첫 렌더 1 + 유무 변화 1 = 2회" 다(plan §12).
it('projects the committed head once and the live tail once per presence change without computing copy text', () => {
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
      live.reasoningVisible = true
      dom.render(createElement(OpenCodeTimeline, props))
    }
    expect(head).toHaveBeenCalledOnce()
    expect(tail).toHaveBeenCalledTimes(2)
    expect(tail.mock.calls.at(-1)?.[1]).toEqual({ text: true, reasoning: true, pending: true })
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
      ...projection.projectTimelineTail(head, { text: false, reasoning: false, pending: false })
    ].filter((row) => row.kind === 'meta')
    expect(metas).toHaveLength(1)
    const row = metas[0]
    if (row.kind !== 'meta') throw new Error('missing meta')
    expect(row.turn.messages).toEqual(messages)
    const copy = vi.spyOn(turns, 'turnCopyText')
    const dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
    try {
      dom.render(withTranscript(createElement(OpenCodeTimelineRow, { row }), 'opencode'))
      const buttons = (node: FakeNode): FakeNode[] => [
        ...(node.tag === 'button' ? [node] : []),
        ...node.children.flatMap(buttons)
      ]
      expect(buttons(dom.body)).toHaveLength(count)
      // 메타 행은 렌더 중 복사 문자열을 만들지 않는다(0325 EP-7 ④).
      expect(copy).not.toHaveBeenCalled()
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
    ...projection.projectTimelineTail(head, { text: false, reasoning: false, pending: false })
  ]
  const row = rows.find((value) => value.kind === 'meta')!
  const copy = vi.spyOn(turns, 'turnCopyText')
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  try {
    dom.render(withTranscript(createElement(OpenCodeTimelineRow, { row }), 'opencode'))
    const buttons = (node: FakeNode): FakeNode[] => [
      ...(node.tag === 'button' ? [node] : []),
      ...node.children.flatMap(buttons)
    ]
    expect(buttons(dom.body)).toHaveLength(count)
    // 메타 행은 렌더 중 복사 문자열을 만들지 않는다(0325 EP-7 ④).
    expect(copy).not.toHaveBeenCalled()
  } finally {
    dom.unmount()
  }
})

// ── 0325 VP-06 · VP-07 ──────────────────────────────────────────────────────────

const timelineProps = (messages: Message[]): Parameters<typeof OpenCodeTimeline>[0] => ({
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
})

// 과거 exchange `past` 개 뒤 현재 exchange(질문 + 확정 assistant `current` 개). 현재 확정 assistant 의
// `parts` 읽기를 센다 — 본문이 빈 text 라 행이 없고, 유무 전이 때만 tail 투영이 읽는다.
function history(past: number, current: number): { messages: Message[]; partReads: () => number } {
  let reads = 0
  const messages: Message[] = []
  for (let index = 0; index < past; index++) {
    messages.push({
      role: 'user',
      createdAt: index * 2 + 1,
      parts: [{ type: 'text', text: `q${index}` }]
    })
    messages.push({
      role: 'assistant',
      createdAt: index * 2 + 2,
      parts: [{ type: 'text', text: `a${index}` }]
    })
  }
  messages.push({ role: 'user', createdAt: past * 2 + 1, parts: [{ type: 'text', text: 'now' }] })
  for (let index = 0; index < current; index++) {
    const parts: Message['parts'] = [{ type: 'text', text: '' }]
    const message = { role: 'assistant', createdAt: past * 2 + 2 + index } as Message
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

// head.rows 를 복사·순회하는 접근을 센다 — 색인 읽기(`at`·숫자 키)와 `length` 는 가시 수에 묶여 허용한다.
const ITERATION = new Set<PropertyKey>([
  Symbol.iterator,
  'slice',
  'concat',
  'map',
  'entries',
  'forEach',
  'filter',
  'flatMap',
  'reduce',
  'values',
  'keys',
  'some',
  'every',
  'find',
  'findIndex',
  'indexOf',
  'includes',
  'join'
])
function countHeadIteration(): { iterations: () => number; reset: () => void } {
  let count = 0
  const real = projection.projectTimelineHead
  vi.spyOn(projection, 'projectTimelineHead').mockImplementation((...args) => {
    const head = real(...args)
    const rows = new Proxy(head.rows, {
      get(source, key, receiver) {
        if (ITERATION.has(key)) count++
        return Reflect.get(source, key, receiver)
      }
    })
    return { ...head, rows }
  })
  return { iterations: () => count, reset: () => void (count = 0) }
}

it.each([
  [100, 10],
  [1_000, 100],
  [10_000, 1_000],
  [10_000, 10]
])(
  're-renders only the live leaf for presence-preserving deltas once the live row exists, at every history size (%i past, %i current)',
  (past, current) => {
    const iteration = countHeadIteration()
    const head = vi.spyOn(projection, 'projectTimelineHead')
    const tail = vi.spyOn(projection, 'projectTimelineTail')
    const { messages, partReads } = history(past, current)
    const props = timelineProps(messages)
    virtual.visible = 2
    const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    try {
      const render = (): void =>
        dom.render(withTranscript(createElement(OpenCodeTimeline, props), 'opencode'))
      render()
      // live 행이 생긴다 — text·reasoning 유무 전이(재투영 1회는 AC20 의 계약).
      Object.assign(live, { text: '1', reasoning: 'r', reasoningVisible: true })
      render()
      head.mockClear()
      tail.mockClear()
      iteration.reset()
      liveHooks.useLiveText.mockClear()
      liveHooks.useLiveReasoning.mockClear()
      const before = partReads()
      // 유무가 그대로인 delta — text 덧붙임 · 유효 reasoning 덧붙임 · 공백 reasoning 조각.
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
      expect(head).not.toHaveBeenCalled()
      expect(tail).not.toHaveBeenCalled()
      expect(partReads() - before).toBe(0)
      expect(iteration.iterations()).toBe(0)
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

// p1~p3 — 유무가 바뀌는 delta 는 tail 을 한 번 다시 투영하고 행 key 는 문자열 투영과 같다. key 가 남는 행은
// 같은 DOM 노드다(0325 AC20 · D-034).
describe('presence transitions', () => {
  const q: Message = { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q' }] }
  const committed: Message = {
    role: 'assistant',
    createdAt: 2,
    parts: [{ type: 'text', text: '확정 본문' }]
  }
  const keysOf = (dom: FakeDom): string[] =>
    dom.body
      .querySelectorAll('[data-timeline-key]')
      .map((node) => node.getAttribute('data-timeline-key')!)
  const nodeOf = (dom: FakeDom, key: string): FakeNode =>
    dom.body.querySelector(`[data-timeline-key="${key}"]`)!
  const expected = (messages: Message[]): string[] =>
    projection.projectTimeline(messages, { ...live, pending: true }).map((row) => row.key)

  it.each([
    {
      name: 'p1 첫 live text 행',
      messages: [q, committed],
      before: { text: '', reasoning: '', reasoningVisible: false },
      after: { text: '답', reasoning: '', reasoningVisible: false },
      gone: undefined as string | undefined
    },
    {
      name: 'p1′ 확정 text 없는 exchange 의 첫 live text 행',
      messages: [q],
      before: { text: '', reasoning: '', reasoningVisible: false },
      after: { text: '답', reasoning: '', reasoningVisible: false },
      gone: undefined
    },
    {
      name: 'p2 live text 행 뒤 reasoning 첫 유효(확정 text 없음)',
      messages: [q],
      before: { text: '답', reasoning: '', reasoningVisible: false },
      after: { text: '답', reasoning: '생각', reasoningVisible: true },
      gone: 'user:1:0:text'
    },
    {
      name: 'p3 확정 text 와 합쳐진 live 행 뒤 reasoning 첫 유효',
      messages: [q, committed],
      before: { text: ' 이어짐', reasoning: '', reasoningVisible: false },
      after: { text: ' 이어짐', reasoning: '생각', reasoningVisible: true },
      gone: undefined
    }
  ])(
    're-projects once per presence transition with string-projection keys and keeps surviving row nodes — $name',
    ({ messages, before, after, gone }) => {
      const iteration = countHeadIteration()
      const tail = vi.spyOn(projection, 'projectTimelineTail')
      virtual.visible = 10
      scroll.enabled = true
      const props = timelineProps(messages)
      const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
      try {
        const render = (): void =>
          dom.render(withTranscript(createElement(OpenCodeTimeline, props), 'opencode'))
        scroll.retained = gone ? [gone] : []
        Object.assign(live, before)
        render()
        const beforeKeys = keysOf(dom)
        expect(beforeKeys).toEqual(expected(messages))
        const nodes = new Map(beforeKeys.map((key) => [key, nodeOf(dom, key)]))
        const inner = (key: string): FakeNode | null =>
          nodeOf(dom, key).querySelector('[data-markdown-mode]')
        const innerNodes = new Map(beforeKeys.map((key) => [key, inner(key)]))
        const extract = (): number[] =>
          (virtual.rangeExtractor as (range: unknown) => number[])({
            startIndex: 0,
            endIndex: 0,
            overscan: 0,
            count: 0
          })
        if (gone) expect(extract()).toEqual([beforeKeys.indexOf(gone)])
        tail.mockClear()
        iteration.reset()
        Object.assign(live, after)
        render()
        expect(tail).toHaveBeenCalledTimes(1)
        // 전이 렌더도 head 행을 복사·순회하지 않는다(EP-2 ⑤⑨).
        expect(iteration.iterations()).toBe(0)
        const afterKeys = keysOf(dom)
        expect(afterKeys).toEqual(expected(messages))
        for (const key of afterKeys) {
          if (!nodes.has(key)) continue
          expect(nodeOf(dom, key)).toBe(nodes.get(key))
          // 행 안의 본문 노드도 같다 — live 행과 확정 행이 같은 컴포넌트 형이다(EP-2 ⑥).
          expect(inner(key)).toBe(innerNodes.get(key))
        }
        if (gone) {
          // 사라진 key 는 선택 보존 목록에서 빠진다 — 보존 범위가 비어 가시 범위에 아무것도 더하지 않는다.
          expect(afterKeys).not.toContain(gone)
          expect(extract()).toEqual([])
        }
      } finally {
        dom.unmount()
      }
    }
  )
})

// 0325 EP-3b ④ — OpenCode Timeline 은 steer 복원 콜백을 대기 버블에 그대로 넘긴다.
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
