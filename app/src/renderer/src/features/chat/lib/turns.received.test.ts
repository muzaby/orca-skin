import { describe, expect, it } from 'vitest'
import { groupExchanges, groupTurns, turnCopyText, turnEquals } from './turns'
import type { Message } from '../reducer/chatReducer'
import type { ReceivedMessageOrigin } from '../../../../../shared/session-schedules'

const literal = '<task-notification>사용자가 직접 입력한 본문</task-notification>'
const message = (role: Message['role'], text: string, origin?: ReceivedMessageOrigin): Message => ({
  role,
  createdAt: 1,
  parts: [{ type: 'text', text, ...(origin ? { origin } : {}) }]
})

describe('received input transcript projection', () => {
  it.each(['automatic', 'scheduled', 'task', 'channel', 'peer'] as const)(
    'hides %s input while retaining literal user input, assistant output and original indexes',
    (kind) => {
      const automatic = message('user', literal, { kind })
      const human = message('user', literal)
      const reply = message('assistant', '처리 결과', { kind })
      const input = [automatic, human, reply, message('user', '다음 입력')]
      const original = structuredClone(input)
      const turns = groupTurns(input)
      expect(turns.map((turn) => turn.startIndex)).toEqual([1, 2, 3])
      expect(turns[0].messages).toEqual([human])
      expect(turns[1].messages[0]).toBe(reply)
      expect(turnCopyText(turns[0])).toBe(literal)
      expect(groupExchanges(input).map((exchange) => exchange.startIndex)).toEqual([1, 3])
      expect(input).toEqual(original)
    }
  )

  it('adds no empty exchange and keeps the earlier turn identity across a received input', () => {
    const input = [message('user', '질문'), message('assistant', '이전 답변')]
    const before = groupTurns(input)
    const automatic = message('user', '자동 이벤트', { kind: 'task' })
    const after = groupTurns([...input, automatic])
    expect(groupExchanges([automatic])).toEqual([])
    expect(after).toHaveLength(2)
    expect(turnEquals(before[1], after[1])).toBe(true)
    const reply = message('assistant', '후속 결과')
    expect(groupTurns([...input, automatic, reply])[1].messages).toEqual([input[1], reply])
  })
})
