import { describe, it, expect } from 'vitest'
import {
  createExchangeGrouper,
  exchangeEquals,
  groupExchanges,
  groupTurns,
  turnCopyText,
  turnEquals,
  type Exchange
} from './turns'
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

describe('groupExchanges', () => {
  it('user 턴마다 새 교환을 만들고 assistant 턴은 직전 교환에 붙는다', () => {
    const messages = [
      msg('user', 'q1'),
      msg('assistant', 'a1'),
      msg('assistant', 'a2'),
      msg('user', 'q2'),
      msg('assistant', 'a3')
    ]
    const exchanges = groupExchanges(messages)
    expect(exchanges).toHaveLength(2)
    expect(exchanges[0].startIndex).toBe(0)
    expect(exchanges[0].turns.map((t) => t.role)).toEqual(['user', 'assistant'])
    expect(exchanges[1].startIndex).toBe(3)
    expect(exchanges[1].turns.map((t) => t.role)).toEqual(['user', 'assistant'])
  })

  it('세션 선두의 assistant 턴은 user 없는 교환이 된다', () => {
    const exchanges = groupExchanges([
      msg('assistant', 'a0'),
      msg('user', 'q'),
      msg('assistant', 'a1')
    ])
    expect(exchanges).toHaveLength(2)
    expect(exchanges[0].turns.map((t) => t.role)).toEqual(['assistant'])
    expect(exchanges[1].startIndex).toBe(1)
  })

  it('빈 입력은 빈 배열', () => {
    expect(groupExchanges([])).toEqual([])
  })
})

describe('exchangeEquals', () => {
  it('같은 messages 로 만든 두 Exchange(객체 identity 다름)는 동일 판정', () => {
    const messages = [msg('user', 'q'), msg('assistant', 'a')]
    const a = groupExchanges(messages)[0]
    const b = groupExchanges(messages)[0]
    expect(a).not.toBe(b)
    expect(exchangeEquals(a, b)).toBe(true)
  })

  it('마지막 메시지 교체(스트리밍 커밋)는 다름 판정 — 마지막 교환만 재렌더', () => {
    const m1 = [msg('user', 'q'), msg('assistant', 'a')]
    const m2 = [...m1.slice(0, 1), msg('assistant', 'a+')]
    const a = groupExchanges(m1)[0]
    const b = groupExchanges(m2)[0]
    expect(exchangeEquals(a, b)).toBe(false)
  })
})

// ── 0325 VP-11 · EP-3 — 증분 그룹화 ──────────────────────────────────────────────
// 매 호출 결과를 `groupExchanges` 전체 결과와 `toEqual` 로 대조하고 재사용·동치 복원·파생 메시지 참조를
// `toBe` 로 단언한다. 메시지마다 고유한 `createdAt` 이 원본 신원이다(교체 = 새 createdAt).
describe('createExchangeGrouper', () => {
  let serial = 0
  const id = (): number => ++serial
  const q = (text: string): Message => ({
    role: 'user',
    createdAt: id(),
    parts: [{ type: 'text', text }]
  })
  const feed = (): Message => ({
    role: 'user',
    createdAt: id(),
    parts: [{ type: 'text', text: 'auto', origin: { kind: 'automatic' } }]
  })
  const mixed = (text: string): Message => ({
    role: 'user',
    createdAt: id(),
    parts: [
      { type: 'text', text },
      { type: 'text', text: 'auto', origin: { kind: 'automatic' } }
    ]
  })
  const a = (text: string): Message => ({
    role: 'assistant',
    createdAt: id(),
    parts: [{ type: 'text', text }]
  })
  const run = (
    grouper: ReturnType<typeof createExchangeGrouper>,
    messages: Message[],
    showAutomaticFeeds = false
  ): Exchange[] => {
    const result = grouper(messages, { showAutomaticFeeds })
    expect(result).toEqual(groupExchanges(messages, { showAutomaticFeeds }))
    return result
  }
  const conversation = (exchanges: number): Message[] =>
    Array.from({ length: exchanges }, (_, index) => [q(`q${index}`), a(`a${index}`)]).flat()

  it('g1 같은 배열·옵션 → 같은 결과 참조', () => {
    const grouper = createExchangeGrouper()
    const messages = conversation(3)
    const first = run(grouper, messages)
    expect(grouper(messages, { showAutomaticFeeds: false })).toBe(first)
  })

  it.each([100, 1_000, 10_000])(
    'g2 과거 exchange %i 개 뒤 assistant 추가 → 앞 exchange·바뀌지 않은 Turn 은 이전 참조',
    (count) => {
      const grouper = createExchangeGrouper()
      const messages = conversation(count)
      // 계수 — 재그룹은 마지막 exchange 부터다. 그 앞 메시지의 `role` 은 두 번째 호출에서 읽지 않는다.
      let reads = 0
      let counting = false
      const counted = messages.map((message, index) => {
        const copy = { ...message }
        Object.defineProperty(copy, 'role', {
          enumerable: true,
          get: () => {
            if (counting && index < messages.length - 2) reads++
            return message.role
          }
        })
        return copy as Message
      })
      const before = run(grouper, counted)
      counting = true
      const next = [...counted, a('추가')]
      const after = grouper(next, { showAutomaticFeeds: false })
      counting = false
      expect(reads).toBe(0)
      expect(after).toEqual(groupExchanges(next))
      for (let index = 0; index < count - 1; index++) expect(after[index]).toBe(before[index])
      const changed = after.filter((exchange, index) => exchange !== before[index])
      expect(changed).toHaveLength(1)
      expect(after[count - 1].turns[0]).toBe(before[count - 1].turns[0])
    }
  )

  it('g3 마지막 메시지 교체 → 앞 exchange 는 이전 참조', () => {
    const grouper = createExchangeGrouper()
    const messages = conversation(4)
    const before = run(grouper, messages)
    const after = run(grouper, [...messages.slice(0, -1), a('교체')])
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3))
    for (let index = 0; index < 3; index++) expect(after[index]).toBe(before[index])
    expect(after[3]).not.toBe(before[3])
  })

  it('g4 중간 교체 → 그 exchange 부터 다시 묶고 뒤 exchange 는 동치 복원', () => {
    const grouper = createExchangeGrouper()
    const messages = conversation(5)
    const before = run(grouper, messages)
    const next = [...messages]
    next[5] = a('교체된 답') // exchange 2 의 답
    const after = run(grouper, next)
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(after[2]).not.toBe(before[2])
    expect(after[2].turns[0]).toBe(before[2].turns[0])
    expect(after[3]).toBe(before[3])
    expect(after[4]).toBe(before[4])
  })

  it('g5 옵션 변경 → 전부 다시 묶고 같은 내용 exchange 는 이전 참조', () => {
    const grouper = createExchangeGrouper()
    const messages = [q('q0'), a('a0'), feed(), a('a1'), q('q2'), a('a2')]
    const hidden = run(grouper, messages, false)
    const shown = run(grouper, messages, true)
    expect(shown).toHaveLength(3)
    expect(hidden).toHaveLength(2)
    // exchange 0 은 숨은 피드를 건너 답 두 개를 합쳤다가 갈라진다 — user Turn 만 같다.
    expect(shown[0]).not.toBe(hidden[0])
    expect(shown[0].turns[0]).toBe(hidden[0].turns[0])
    expect(shown[2]).toBe(hidden[1])
  })

  it('g6 다른 세션(첫 메시지 다름) → 전부 다시 묶는다', () => {
    const grouper = createExchangeGrouper()
    run(grouper, conversation(3))
    const other = conversation(2)
    const result = run(grouper, other)
    expect(result.map((exchange) => exchange.startIndex)).toEqual([0, 2])
  })

  it('g7 경계에 user 추가 → 앞 exchange 는 이전 참조 · 새 exchange 추가', () => {
    const grouper = createExchangeGrouper()
    const messages = conversation(3)
    const before = run(grouper, messages)
    const after = run(grouper, [...messages, q('새 질문')])
    expect(after).toHaveLength(4)
    for (let index = 0; index < 3; index++) expect(after[index]).toBe(before[index])
  })

  it('g8 경계 메시지가 자동 피드만 남아 숨으면 직전 exchange 부터 다시 묶는다', () => {
    const grouper = createExchangeGrouper()
    const qA = q('질문 A'),
      aA = a('답변 A'),
      qB = q('질문 B'),
      aB = a('답변 B')
    run(grouper, [qA, aA, qB, aB])
    const hiddenB: Message = { ...feed(), createdAt: qB.createdAt }
    const after = run(grouper, [qA, aA, hiddenB, aB])
    expect(after).toEqual([
      {
        startIndex: 0,
        turns: [
          { role: 'user', messages: [qA], startIndex: 0 },
          { role: 'assistant', messages: [aA, aB], startIndex: 1 }
        ]
      }
    ])
  })

  it('g9 선두 assistant exchange 안의 변경', () => {
    const grouper = createExchangeGrouper()
    const messages = [a('a0'), a('a1'), q('q'), a('a2')]
    const before = run(grouper, messages)
    const next = [...messages]
    next[1] = a('교체')
    const after = run(grouper, next)
    expect(after[0]).not.toBe(before[0])
    expect(after[1]).toBe(before[1])
  })

  it('g10 다시 묶은 exchange 안의 바뀌지 않은 Turn 은 이전 참조', () => {
    const grouper = createExchangeGrouper()
    const messages = [q('qA'), a('aA'), q('qB'), a('aB1')]
    const before = run(grouper, messages)
    const after = run(grouper, [...messages, a('aB2')])
    expect(after[1]).not.toBe(before[1])
    expect(after[1].turns[0]).toBe(before[1].turns[0])
    expect(after[1].turns[1]).not.toBe(before[1].turns[1])
  })

  it('g11 경계 메시지를 보이는 user 로 교체 → 직전 exchange 도 다시 묶지만 동치 복원', () => {
    const grouper = createExchangeGrouper()
    const messages = [q('qA'), a('aA'), q('qB'), a('aB')]
    const before = run(grouper, messages)
    const next = [...messages]
    next[2] = q('qB 교체')
    const after = run(grouper, next)
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    expect(after[1].turns[1]).toBe(before[1].turns[1])
  })

  it('g12 첫 exchange 앞 숨은 메시지가 보이게 되면 그 지점부터 다시 묶는다', () => {
    const grouper = createExchangeGrouper()
    const feedA = feed(),
      feedB = feed(),
      answer = a('답변')
    expect(run(grouper, [feedA, feedB, answer]).map((exchange) => exchange.startIndex)).toEqual([2])
    const qB = q('질문 B')
    const after = run(grouper, [feedA, qB, answer])
    expect(after).toEqual([
      {
        startIndex: 1,
        turns: [
          { role: 'user', messages: [qB], startIndex: 1 },
          { role: 'assistant', messages: [answer], startIndex: 2 }
        ]
      }
    ])
  })

  it.each([false, true])(
    'g13 섞인 user 뒤 assistant 추가 → 그 user 메시지와 user Turn 이 이전 참조 (showAutomaticFeeds=%s)',
    (show) => {
      const grouper = createExchangeGrouper()
      const messages = [mixed('수동 질문'), a('답변 1')]
      const before = run(grouper, messages, show)
      const after = run(grouper, [...messages, a('답변 2')], show)
      expect(after[0]).not.toBe(before[0])
      expect(after[0].turns[0].messages[0]).toBe(before[0].turns[0].messages[0])
      expect(after[0].turns[0]).toBe(before[0].turns[0])
    }
  )

  it('g14 소형 전수 — 결과 ≡ 전체 그룹화 · 같은 startIndex 안의 같은 원본 Turn·메시지는 이전 참조', () => {
    const makers = [() => q('u'), () => feed(), () => mixed('m'), () => a('a')]
    const sequences: number[][] = []
    const extend = (prefix: number[]): void => {
      if (prefix.length) sequences.push(prefix)
      if (prefix.length === 4) return
      for (let kind = 0; kind < makers.length; kind++) extend([...prefix, kind])
    }
    extend([])
    const sameOrigin = (
      left: Exchange['turns'][number],
      right: Exchange['turns'][number]
    ): boolean =>
      left.messages.length === right.messages.length &&
      left.messages.every((message, index) => message.createdAt === right.messages[index].createdAt)
    let cases = 0
    for (const show of [false, true]) {
      for (const kinds of sequences) {
        const base = kinds.map((kind) => makers[kind]())
        const changes: Array<{ next: Message[]; show: boolean; references: boolean }> = []
        for (const make of makers) changes.push({ next: [...base, make()], show, references: true })
        for (let position = 0; position < base.length; position++)
          for (const make of makers) {
            const next = [...base]
            next[position] = make()
            changes.push({ next, show, references: true })
          }
        changes.push({ next: base, show: !show, references: false })
        changes.push({ next: base.slice(0, -1), show, references: true })
        for (const change of changes) {
          const grouper = createExchangeGrouper()
          const before = run(grouper, base, show)
          const after = run(grouper, change.next, change.show)
          cases++
          if (!change.references) continue
          for (const exchange of after) {
            const previous = before.find(
              (candidate) => candidate.startIndex === exchange.startIndex
            )
            if (!previous) continue
            for (const turn of exchange.turns) {
              const old = previous.turns.find(
                (candidate) => candidate.startIndex === turn.startIndex
              )
              if (!old || !sameOrigin(old, turn)) continue
              expect(turn).toBe(old)
              turn.messages.forEach((message, index) => expect(message).toBe(old.messages[index]))
            }
          }
        }
      }
    }
    // Σ_L 4^L × (4 + 4L + 2), L = 1~4 · 옵션 2
    expect(cases).toBe(2 * (4 * 10 + 16 * 14 + 64 * 18 + 256 * 22))
  })
})
