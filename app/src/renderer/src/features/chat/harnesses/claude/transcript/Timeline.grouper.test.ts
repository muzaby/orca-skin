// Claude Timeline 의 증분 그룹화 배선 (0325 EP-3 ⑦ · EP-3b ③ · VP-10 · VP-12).
// 마운트 동안 grouper 하나가 살아 있어 확정 메시지가 추가돼도 앞 exchange 는 같은 객체로 Exchange 에 간다.
// steer 복원 콜백은 마지막 Exchange 로 그대로 넘어간다.
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { Message } from '../../../reducer/chatReducer'
import type { Exchange as ExchangeGroup } from '../../../lib/turns'
import { ClaudeTranscriptView } from './Timeline'

const seen = vi.hoisted(() => ({
  exchanges: [] as Array<{ exchange: unknown; onRestoreSteerDraft?: unknown }>
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
// Exchange 는 이 oracle 의 관측점이다 — 받은 props 를 기록한다.
vi.mock('./Exchange', () => ({
  Exchange: (props: { exchange: unknown; onRestoreSteerDraft?: unknown }) => {
    seen.exchanges.push({
      exchange: props.exchange,
      onRestoreSteerDraft: props.onRestoreSteerDraft
    })
    return null
  }
}))
vi.mock('../../../hooks/useTranscriptVirtualizer', () => ({
  useTranscriptVirtualizer: (head: unknown[]) => ({
    getVirtualItems: () => head.map((_, index) => ({ index, start: 0 })),
    getTotalSize: () => 0,
    measureElement: () => {}
  })
}))
vi.mock('./PendingAssistant', () => ({ PendingAssistant: () => null }))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  seen.exchanges = []
  vi.unstubAllGlobals()
})

const q = (index: number): Message => ({
  role: 'user',
  createdAt: index * 2 + 1,
  parts: [{ type: 'text', text: `q${index}` }]
})
const a = (index: number, text = `a${index}`): Message => ({
  role: 'assistant',
  createdAt: index * 2 + 2,
  parts: [{ type: 'text', text }]
})

function render(
  messages: Message[],
  onRestoreSteerDraft = (): void => {},
  showAutomaticFeeds = false
): ExchangeGroup[] {
  dom ??= installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  seen.exchanges = []
  dom.render(
    createElement(ClaudeTranscriptView, {
      agentKind: 'code',
      messages,
      pendingSteer: [],
      onRestoreSteerDraft,
      inflight: false,
      loadingSession: false,
      anchored: false,
      scrollRef: { current: null },
      contentRef: { current: null },
      onScroll: () => {},
      textScaleClassName: '',
      showAutomaticFeeds
    })
  )
  return seen.exchanges.map((entry) => entry.exchange as ExchangeGroup)
}

describe('ClaudeTranscriptView 증분 그룹화 배선', () => {
  it('확정 메시지가 추가돼도 앞 exchange 는 같은 객체로 Exchange 에 간다', () => {
    const messages = [q(0), a(0), q(1), a(1), q(2), a(2)]
    const before = render(messages)
    expect(before.map((exchange) => exchange.startIndex)).toEqual([0, 2, 4])
    const after = render([...messages, a(3, '추가')])
    expect(after.map((exchange) => exchange.startIndex)).toEqual([0, 2, 4])
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(after[2]).not.toBe(before[2])
    expect(after[2].turns[0]).toBe(before[2].turns[0])
  })

  it('같은 messages 에서 자동 피드 표시를 바꾸면 다시 묶는다', () => {
    const feed: Message = {
      role: 'user',
      createdAt: 3,
      parts: [{ type: 'text', text: 'auto', origin: { kind: 'automatic' } }]
    }
    const messages = [q(0), a(0), feed, a(5), q(2), a(2)]
    expect(render(messages, () => {}, false).map((exchange) => exchange.startIndex)).toEqual([0, 4])
    expect(render(messages, () => {}, true).map((exchange) => exchange.startIndex)).toEqual([
      0, 2, 4
    ])
  })

  it('steer 복원 콜백은 마지막 Exchange 로 그대로 넘어간다', () => {
    const restore = vi.fn()
    render([q(0), a(0), q(1), a(1)], restore)
    expect(seen.exchanges.at(-1)?.onRestoreSteerDraft).toBe(restore)
  })
})
