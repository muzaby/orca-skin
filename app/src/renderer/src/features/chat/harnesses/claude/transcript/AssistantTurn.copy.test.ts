// Claude assistant 턴 메타의 지연 복사 (0325 VP-26 y1·y2·y4·y5 · EP-7 ②).
// 렌더 중에는 복사 문자열을 만들지 않고 클릭 때 한 번 만든다. 버튼 노출은 `hasPartsText` 다.
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { initialChatState, type Message } from '../../../reducer/chatReducer'
import * as turns from '../../../lib/turns'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import { withTranscript } from '../../registries/transcript.testfixture'
import { AssistantTurn } from './AssistantTurn'

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
  useChatSession: (select: (state: typeof initialChatState) => unknown) => select(initialChatState),
  chatActions: {}
}))
// 본문 렌더는 이 oracle 밖이다 — 메타의 복사 버튼만 본다.
vi.mock('../../common/transcript/AssistantMessage', () => ({ AssistantMessage: () => null }))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const transcriptPolicy = agentUiPolicy('code').transcript
const turn = (parts: Message['parts'][]): turns.Turn => ({
  role: 'assistant',
  startIndex: 0,
  messages: parts.map((p, index) => ({ role: 'assistant', createdAt: index + 1, parts: p }))
})
const copyButtons = (): ReturnType<FakeDom['queryAll']> =>
  dom!.queryAll('[aria-label="common.copyMessage"]')
const render = (value: turns.Turn): void => {
  if (!dom) vi.useFakeTimers()
  dom ??= installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  dom.render(
    withTranscript(createElement(AssistantTurn, { turn: value, pending: false, transcriptPolicy }))
  )
}

describe('AssistantTurn 지연 복사', () => {
  it('y1 텍스트 턴 — 렌더 중 0회 · 클릭 때 1회 · 문자열은 기존 계산과 같다', async () => {
    const writeText = vi.fn(async () => {})
    const copy = vi.spyOn(turns, 'turnCopyText')
    const value = turn([[{ type: 'text', text: '첫 문단' }], [{ type: 'text', text: '둘째 문단' }]])
    render(value)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(value)
    expect(copy).not.toHaveBeenCalled()
    expect(copyButtons()).toHaveLength(1)
    dom!.click(copyButtons()[0])
    await Promise.resolve()
    expect(copy).toHaveBeenCalledOnce()
    copy.mockRestore()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(turns.turnCopyText(value))
  })

  it.each([
    ['도구만', [[{ type: 'tool_call', toolRunId: 't', toolName: 'Read', args: {} }]]],
    ['공백', [[{ type: 'text', text: '   ' }]]],
    ['자식 텍스트', [[{ type: 'text', text: 'child', parentToolRunId: 'task' }]]]
  ] as const)('y2 %s 턴 — 버튼 0', (_name, parts) => {
    const copy = vi.spyOn(turns, 'turnCopyText')
    render(turn(parts as unknown as Message['parts'][]))
    expect(copyButtons()).toHaveLength(0)
    expect(copy).not.toHaveBeenCalled()
  })

  it('y4 공백 1,000,000자 text 하나뿐인 턴 — 버튼 0 · 렌더 중 0회', () => {
    const copy = vi.spyOn(turns, 'turnCopyText')
    render(turn([[{ type: 'text', text: ' '.repeat(1_000_000) }]]))
    expect(copyButtons()).toHaveLength(0)
    expect(copy).not.toHaveBeenCalled()
  })

  it('y5 non-text part 20,000개 뒤 마지막 part 만 본문 — 버튼 1 · 클릭하면 그 본문', async () => {
    const writeText = vi.fn(async () => {})
    const copy = vi.spyOn(turns, 'turnCopyText')
    const parts: Message['parts'] = [
      ...Array.from({ length: 20_000 }, () => ({ type: 'reasoning' as const, text: '생각' })),
      { type: 'text', text: '마지막 본문' }
    ]
    render(turn([parts]))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(copyButtons()).toHaveLength(1)
    expect(copy).not.toHaveBeenCalled()
    dom!.click(copyButtons()[0])
    await Promise.resolve()
    expect(copy).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledExactlyOnceWith('마지막 본문')
  })
})
