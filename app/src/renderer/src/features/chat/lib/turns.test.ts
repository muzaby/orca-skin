import { describe, it, expect } from 'vitest'
import { groupTurns, turnCopyText, turnEquals } from './turns'
import type { Message } from '../reducer/chatReducer'

const msg = (role: 'user' | 'assistant', content: string, createdAt = 0): Message => ({
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

describe('turnEquals', () => {
  it('같은 messages 배열로 만든 두 Turn(객체 identity 다름)은 동일 판정', () => {
    const messages = [msg('user', 'q'), msg('assistant', 'a1'), msg('assistant', 'a2')]
    const a = groupTurns(messages)
    const b = groupTurns(messages) // 매 호출 새 Turn 객체 — 내용 비교로 같아야 한다
    expect(a[0]).not.toBe(b[0])
    expect(turnEquals(a[0], b[0])).toBe(true)
    expect(turnEquals(a[1], b[1])).toBe(true)
  })

  it('마지막 메시지 객체가 교체되면(스트리밍 parts 추가) 다른 판정', () => {
    const base = [msg('user', 'q'), msg('assistant', 'a1')]
    // appendAssistantPart 와 동형 — 마지막 메시지만 새 객체로 교체.
    const next = base.slice()
    next[1] = { ...base[1], parts: [...base[1].parts, { type: 'text', text: ' more' }] }
    const [, beforeTurn] = groupTurns(base)
    const [, afterTurn] = groupTurns(next)
    expect(turnEquals(beforeTurn, afterTurn)).toBe(false)
  })

  it('메시지가 추가돼 길이가 다르면 다른 판정', () => {
    const base = [msg('user', 'q'), msg('assistant', 'a1')]
    const next = [...base, msg('assistant', 'a2')]
    const [, beforeTurn] = groupTurns(base)
    const [, afterTurn] = groupTurns(next)
    expect(turnEquals(beforeTurn, afterTurn)).toBe(false)
  })

  it('role / startIndex 가 다르면 다른 판정 (동일 내용이어도)', () => {
    const a = groupTurns([msg('user', 'q'), msg('assistant', 'a')])
    const b = groupTurns([msg('assistant', 'a'), msg('user', 'q')])
    expect(turnEquals(a[0], b[1])).toBe(false) // 같은 user 메시지지만 startIndex 0 vs 1
    expect(turnEquals(a[0], b[0])).toBe(false) // role 다름
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
