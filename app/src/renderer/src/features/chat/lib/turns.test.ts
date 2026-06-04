import { describe, it, expect } from 'vitest'
import { groupTurns, turnCopyText } from './turns'
import type { Message } from '../reducer/chatReducer'

const msg = (role: 'user' | 'assistant', content: string, createdAt = 0): Message => ({
  role,
  content,
  createdAt
})

describe('groupTurns', () => {
  it('연속 동일 role 을 한 턴으로 묶는다', () => {
    const turns = groupTurns([
      msg('user', 'q'),
      msg('assistant', 'a1'),
      msg('assistant', ''), // 툴콜 전용 메시지
      msg('assistant', 'a2'),
      msg('user', 'q2'),
      msg('assistant', 'a3')
    ])
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(turns[1].messages).toHaveLength(3)
    expect(turns[1].startIndex).toBe(1)
  })

  it('빈 입력은 빈 배열', () => {
    expect(groupTurns([])).toEqual([])
  })
})

describe('turnCopyText', () => {
  it('빈 content 는 제외하고 합친다', () => {
    const [turn] = groupTurns([
      msg('assistant', 'a1'),
      msg('assistant', ''),
      msg('assistant', 'a2')
    ])
    expect(turnCopyText(turn)).toBe('a1\n\na2')
  })
})
