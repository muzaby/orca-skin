import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { Message } from '../../../reducer/chatReducer'
import { newTranscriptChanges, recordChange } from '../../../lib/transcript/changeLog'
import { ClaudeTranscriptView } from './Timeline'
import { createClaudeBlockModel } from './claudeBlocks'
import { snapshotToArray } from '../../../lib/blockOracle.testfixture'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':r0:'
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

const viewportPropsLog = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }))
vi.mock('../../../components/transcript/TranscriptViewport', async () => {
  const { createElement } = await import('react')
  return {
    TranscriptViewport: (props: Record<string, unknown>) => {
      viewportPropsLog.last = props
      return createElement('div', { 'data-mock-viewport': 'true' }, props.footer as React.ReactNode)
    },
    writeScrollTop: vi.fn(),
    useTranscriptReveal: () => vi.fn()
  }
})
vi.mock('../../../store/chatStore', () => ({
  useActiveSessionKey: () => 's1',
  useTranscriptChanges: () =>
    recordChange(newTranscriptChanges(), { kind: 'reset', complete: true }),
  useHasLiveText: () => false,
  useHasLiveReasoning: () => false,
  useLiveText: () => '',
  useLiveReasoning: () => '',
  useChatActivity: () => ({ foreground: null, background: [] }),
  useTranscriptView: () => ({}),
  useChatSession: (sel: (s: unknown) => unknown) =>
    sel({
      activity: { foreground: null },
      sessionId: 's1',
      listenStartedAt: 0,
      worktreePrepareStep: null
    })
}))
vi.mock('../../../../../shared/theme/TweakProvider', () => ({
  useOptionalTweak: (sel: (t: Record<string, unknown>) => unknown) =>
    sel({ bubbleCollapseLines: 6 })
}))
vi.mock('../../common/transcript/UserBubbleText', async () => {
  const { createElement } = await import('react')
  return {
    UserBubbleText: ({ text, children }: { text?: string; children?: React.ReactNode }) =>
      createElement('span', null, text ?? children)
  }
})
vi.mock('../../common/transcript/TranscriptRuntime', () => ({
  useTranscriptRuntime: () => ({
    appearance: { userBubbleStyle: 'flat' },
    cancelSteer: vi.fn(),
    forkFromMessage: vi.fn(),
    openFile: vi.fn(),
    openArtifact: vi.fn()
  })
}))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  viewportPropsLog.last = null
})

describe('harnesses/claude/transcript/Timeline.viewport (VP-24 · VP-37 · EP-11 ⑥⑦)', () => {
  it('enables reserve gap on anchored send, renders pending indicator & steer-restore in tail footer, and marks forkable only on the last assistant turn meta', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const messages: Message[] = [
      { id: 'u:1', role: 'user', createdAt: 1000, parts: [{ type: 'text', text: 'first q' }] },
      { id: 'a:1', role: 'assistant', createdAt: 2000, parts: [{ type: 'text', text: 'first a' }] },
      { id: 'u:2', role: 'user', createdAt: 3000, parts: [{ type: 'text', text: 'second q' }] },
      { id: 'a:2', role: 'assistant', createdAt: 4000, parts: [{ type: 'text', text: 'second a' }] }
    ]

    // 1. Block model: forkable is true ONLY on the last assistant turn's meta block (EP-11 ⑦)
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    const snap = model.advance(
      {
        messages,
        transcriptChanges: recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
      },
      { forkable: true, reserve: true }
    )
    const metas = snapshotToArray(snap).filter((b) => b.kind === 'meta')
    expect(metas).toHaveLength(2)
    expect(metas[0].kind === 'meta' && metas[0].forkable).toBe(false)
    expect(metas[1].kind === 'meta' && metas[1].forkable).toBe(true)

    // 2. Timeline wires enableReserveGap and tail footer with pending indicator + pending steer
    const restoreA = vi.fn()
    dom.render(
      createElement(ClaudeTranscriptView, {
        agentKind: 'code',
        backend: 'claude',
        messages,
        pendingSteer: [{ id: 'st1', text: 'steer me', createdAt: 5000 }],
        onRestoreSteerDraft: restoreA,
        inflight: true,
        loadingSession: false,
        error: undefined,
        anchored: true,
        textScaleClassName: '',
        showAutomaticFeeds: false,
        scrollRef: { current: null },
        contentRef: { current: null },
        onScroll: () => {}
      })
    )
    expect(viewportPropsLog.last?.enableReserveGap).toBe(true)
    expect(dom.body.textContent).toContain('steer me')
  })

  it('re-renders when only the steer-restore callback changes', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const messages: Message[] = [
      { id: 'u:1', role: 'user', createdAt: 1000, parts: [{ type: 'text', text: 'hi' }] }
    ]
    const pendingSteer = [{ id: 'st1', text: 'draft steer', createdAt: 2000 }]
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const sharedProps = {
      agentKind: 'code' as const,
      backend: 'claude' as const,
      messages,
      pendingSteer,
      inflight: true,
      loadingSession: false,
      error: undefined,
      anchored: true,
      textScaleClassName: '',
      showAutomaticFeeds: false,
      scrollRef: { current: null },
      contentRef: { current: null },
      onScroll: () => {}
    }

    dom.render(createElement(ClaudeTranscriptView, { ...sharedProps, onRestoreSteerDraft: cb1 }))
    const firstFooter = viewportPropsLog.last?.footer
    dom.render(createElement(ClaudeTranscriptView, { ...sharedProps, onRestoreSteerDraft: cb2 }))
    const secondFooter = viewportPropsLog.last?.footer
    expect(secondFooter).not.toBe(firstFooter)
  })
})

// 0331 ΔV6 EP-20 ②③ — 실제 Timeline 이 viewport 에 넘긴 행마다 renderBlock 이 내용을 그린다(D-029 · VP-53).
describe('AC18 Claude Timeline rows', () => {
  type Rendered = { snapshot: { count: number; blockAt(i: number): { kind: string } } }
  const rowsFor = (messages: Message[]): { kinds: string[]; empty: number } => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    dom.render(
      createElement(ClaudeTranscriptView, {
        agentKind: 'code',
        backend: 'claude',
        messages,
        pendingSteer: [],
        onRestoreSteerDraft: () => {},
        inflight: false,
        loadingSession: false,
        error: undefined,
        anchored: false,
        textScaleClassName: '',
        showAutomaticFeeds: false,
        scrollRef: { current: null },
        contentRef: { current: null },
        onScroll: () => {}
      })
    )
    const props = viewportPropsLog.last as unknown as Rendered & {
      renderBlock: (block: unknown, index: number) => React.ReactNode
    }
    const blocks = Array.from({ length: props.snapshot.count }, (_, i) => props.snapshot.blockAt(i))
    const kinds = blocks.map((block) =>
      block.kind === 'segment'
        ? 'segment:' + (block as unknown as { segment: { kind: string } }).segment.kind
        : block.kind
    )
    // 본문 행(segment)을 실제로 그려 글이 없는 행 수를 센다.
    const empty = blocks.filter((block, i) => {
      if (block.kind !== 'segment') return false
      const row = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
      row.render(props.renderBlock(block, i) as React.ReactElement)
      const text = row.container.textContent?.trim() ?? ''
      row.unmount()
      return text === ''
    }).length
    dom.unmount()
    dom = undefined
    return { kinds, empty }
  }
  const ask = (args: Record<string, unknown>, result?: unknown): Message['parts'] => [
    { type: 'tool_call', toolRunId: 'ask', toolName: 'AskUserQuestion', args },
    ...(result === undefined
      ? []
      : [{ type: 'tool_result' as const, toolRunId: 'ask', isError: false, result }])
  ]
  const turn = (parts: Message['parts']): Message[] => [
    { id: 'u', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q' }] },
    {
      id: 'a',
      role: 'assistant',
      createdAt: 2,
      parts: [{ type: 'text', text: 'Let me ask' }, ...parts]
    }
  ]
  const question = { questions: [{ question: 'Pick?', header: 'h' }] }

  it('AC18 pending ask leaves no row', () => {
    expect(rowsFor(turn(ask(question)))).toEqual({
      kinds: ['user', 'segment:text', 'meta'],
      empty: 0
    })
    // 대조 — 답한 질문은 행 1개이고 내용을 그린다.
    expect(rowsFor(turn(ask({ ...question, answers: { 'Pick?': 'a' } })))).toEqual({
      kinds: ['user', 'segment:text', 'segment:ask', 'meta'],
      empty: 0
    })
  })

  it('AC18 answered ask without items leaves no row', () => {
    expect(rowsFor(turn(ask({ questions: [] }, { response: 'done' })))).toEqual({
      kinds: ['user', 'segment:text', 'meta'],
      empty: 0
    })
  })
})
