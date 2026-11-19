import { describe, it, expect } from 'vitest'
import { groupTurns, turnCopyText, turnEquals } from './turns'
import type { Message } from '../reducer/chatReducer'

let seq = 0
const msg = (role: 'user' | 'assistant', content: string, createdAt = 0): Message => ({
  id: `m-${++seq}`,
  role,
  createdAt,
  parts: content === '' ? [] : [{ type: 'text', text: content }]
})

describe('groupTurns', () => {
  it('연속 동일 role 을 한 턴으로 묶는다', () => {
    const turns = groupTurns([
      msg('user', 'q'),
      msg('assistant', 'a1'),
      msg('assistant', ''), // 툴콜 전용 메시지
      msg('assistant', 'a2'),
      msg('user', 'q2')
    ])
    expect(turns).toHaveLength(3)
    expect(turns.map((t) => [t.role, t.startIndex, t.messages.length])).toEqual([
      ['user', 0, 1],
      ['assistant', 1, 3],
      ['user', 4, 1]
    ])
  })

  it('빈 입력은 빈 배열', () => {
    expect(groupTurns([])).toEqual([])
  })
})

describe('turnEquals', () => {
  it('같은 messages 배열로 만든 두 Turn(객체 identity 다름)은 동일 판정', () => {
    const messages = [msg('assistant', 'a1'), msg('assistant', 'a2')]
    const a = groupTurns(messages)[0]
    const b = groupTurns(messages)[0]
    expect(a).not.toBe(b)
    expect(turnEquals(a, b)).toBe(true)
  })

  it('마지막 메시지 객체가 교체되면(스트리밍 parts 추가) 다른 판정', () => {
    const m1 = [msg('assistant', 'a1'), msg('assistant', 'a2')]
    const m2 = [m1[0], msg('assistant', 'a2+')]
    const a = groupTurns(m1)[0]
    const b = groupTurns(m2)[0]
    expect(turnEquals(a, b)).toBe(false)
  })

  it('메시지가 추가돼 길이가 다르면 다른 판정', () => {
    const m1 = [msg('assistant', 'a1')]
    const m2 = [...m1, msg('assistant', 'a2')]
    expect(turnEquals(groupTurns(m1)[0], groupTurns(m2)[0])).toBe(false)
  })

  it('role / startIndex 가 다르면 다른 판정 (동일 내용이어도)', () => {
    const [a] = groupTurns([msg('user', 'x')])
    const [b] = groupTurns([msg('assistant', 'x')])
    expect(turnEquals(a, b)).toBe(false)
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
