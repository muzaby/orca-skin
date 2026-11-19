// 세션 본문 조각의 분할·조립 (0324 EP-6″ 규칙 칸 · AC16″).
import { describe, expect, it } from 'vitest'
import {
  assembleSession,
  estimateWireChars,
  nextSessionChunkEnd,
  SESSION_CHUNK_MAX_CHARS,
  SESSION_CHUNK_MAX_MESSAGES,
  SESSION_CHUNK_MAX_PARTS,
  splitSessionMessages,
  type ChunkedSession
} from './data-host'
import type { LoadedMessage, LoadedSession } from './ipc'

const message = (parts: number, tag: string): LoadedMessage => ({
  role: 'assistant',
  createdAt: 1,
  parts: Array.from({ length: parts }, (_, index) => ({ type: 'text', text: `${tag}-${index}` }))
})
const partCount = (chunk: LoadedMessage[]): number =>
  chunk.reduce((sum, item) => sum + item.parts.length, 0)
const partsPerMessage = (chunk: LoadedMessage[]): number[] => chunk.map((item) => item.parts.length)

const head = (messages: LoadedMessage[], chunks: number): ChunkedSession => ({
  id: 's1',
  backend: 'claude',
  agentKind: 'code',
  title: '제목',
  messages: [],
  chunked: { chunks, messages: messages.length }
})

describe('세션 조각 분할', () => {
  it('상한은 500 part 다', () => {
    expect(SESSION_CHUNK_MAX_PARTS).toBe(500)
  })

  it('part 합이 500 이하인 세션은 조각 하나다', () => {
    const messages = Array.from({ length: 50 }, (_, index) => message(10, `m${index}`))
    const chunks = splitSessionMessages(messages)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual(messages)
  })

  it('1,200 part(메시지당 10)는 조각 셋이고 각 조각은 500 part 를 넘지 않는다', () => {
    const messages = Array.from({ length: 120 }, (_, index) => message(10, `m${index}`))
    const chunks = splitSessionMessages(messages)
    expect(chunks.map(partCount)).toEqual([500, 500, 200])
    expect(chunks.flat()).toEqual(messages)
  })

  it('part 700 인 메시지 하나는 혼자 한 조각이다', () => {
    const messages = [message(10, 'before'), message(700, 'big'), message(10, 'after')]
    const chunks = splitSessionMessages(messages)
    expect(chunks.map(partCount)).toEqual([10, 700, 10])
    expect(chunks[1]).toEqual([messages[1]])
  })

  it('첫 메시지가 상한을 넘어도 빈 조각은 없다 — 그 메시지가 첫 조각이다', () => {
    const messages = [message(700, 'big'), message(10, 'after')]
    const chunks = splitSessionMessages(messages)
    expect(chunks.map(partCount)).toEqual([700, 10])
    expect(chunks[0]).toEqual([messages[0]])
  })

  // part 0 메시지(이미지만 보낸 사용자 턴 — `native-history-map.ts`)도 메시지 하나다(0324 EP-6″ · AC16″).
  // 조각마다 part 합은 part 0 메시지가 어느 조각에 드는지 구별하지 못해 메시지별 part 수로 본다.
  it('part 0 메시지 뒤에 상한을 넘는 메시지가 오면 그 메시지는 혼자 한 조각이다', () => {
    const messages = [message(0, 'image-only'), message(700, 'big')]
    const chunks = splitSessionMessages(messages)
    expect(chunks.map(partsPerMessage)).toEqual([[0], [700]])
    expect(chunks.flat()).toEqual(messages)
  })

  it('상한을 넘는 메시지 뒤 끝의 part 0 메시지는 빠지지 않고 다음 조각이다', () => {
    const messages = [message(700, 'big'), message(0, 'image-only')]
    const chunks = splitSessionMessages(messages)
    expect(chunks.map(partsPerMessage)).toEqual([[700], [0]])
    expect(chunks.flat()).toEqual(messages)
  })

  it('메시지가 없으면 조각이 없다', () => {
    expect(splitSessionMessages([])).toEqual([])
  })

  it('상한에 딱 맞는 다음 메시지는 같은 조각에 들어간다', () => {
    const messages = [message(250, 'a'), message(250, 'b'), message(1, 'c')]
    expect(splitSessionMessages(messages).map(partCount)).toEqual([500, 1])
  })
})

describe('세션 조각 조립', () => {
  const messages = Array.from({ length: 120 }, (_, index) => message(10, `m${index}`))
  const chunks = splitSessionMessages(messages).map((part, seq) => ({ seq, messages: part }))

  it('분할한 조각을 조립하면 원래 세션과 같다', () => {
    const original: LoadedSession = { ...head(messages, 3), messages }
    delete (original as Partial<ChunkedSession>).chunked
    expect(assembleSession(head(messages, 3), chunks)).toEqual(original)
  })

  it('메시지가 없는 세션은 조각 없이 조립된다', () => {
    expect(assembleSession(head([], 0), []).messages).toEqual([])
  })

  it.each([
    ['조각이 하나 빠졌다', chunks.slice(0, 2), '세션 조각 수가 다르다'],
    ['번호가 이어지지 않는다', [chunks[0], chunks[2], chunks[1]], '세션 조각 순서가 어긋났다'],
    [
      '메시지 수가 다르다',
      [chunks[0], chunks[1], { seq: 2, messages: chunks[2].messages.slice(1) }],
      '세션 메시지 수가 다르다'
    ]
  ])('%s → 던진다', (_name, received, error) => {
    expect(() => assembleSession(head(messages, 3), received)).toThrow(error)
  })
})

// 0325 EP-1 ①~⑥·⑨ — 세 예산(메시지 500 · part 500 · 근사 문자 1,000,000)과 단독 조각·조기 중단·루프 조립.
// 경계 입력은 `estimateWireChars` 의 실제 값으로 만든다 — 테스트가 규칙을 다시 구현하지 않는다.
describe('세션 조각 세 예산 (0325 VP-03)', () => {
  const empty = (index: number): LoadedMessage => ({ role: 'user', createdAt: index, parts: [] })
  // 근사 문자가 정확히 `chars` 인 메시지 하나.
  const sized = (chars: number, tag = 's'): LoadedMessage => {
    const base: LoadedMessage = {
      role: 'assistant',
      createdAt: 1,
      parts: [{ type: 'text', text: tag }]
    }
    const overhead = estimateWireChars(base) - tag.length
    const text = tag.padEnd(chars - overhead, 'x')
    const out: LoadedMessage = { ...base, parts: [{ type: 'text', text }] }
    expect(estimateWireChars(out)).toBe(chars)
    return out
  }
  const sizes = (chunks: LoadedMessage[][]): number[] => chunks.map((chunk) => chunk.length)
  // parts 배열의 색인 읽기를 센다.
  const countedParts = (target: LoadedMessage): { message: LoadedMessage; reads: () => number } => {
    let reads = 0
    const parts = new Proxy(target.parts, {
      get(source, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads++
        return Reflect.get(source, key, receiver)
      }
    })
    return { message: { ...target, parts }, reads: () => reads }
  }

  it('상한은 메시지 500 · part 500 · 문자 1,000,000 이다', () => {
    expect([SESSION_CHUNK_MAX_MESSAGES, SESSION_CHUNK_MAX_PARTS, SESSION_CHUNK_MAX_CHARS]).toEqual([
      500, 500, 1_000_000
    ])
  })

  it('e1 메시지 501번째는 새 조각이다', () => {
    const messages = Array.from({ length: 501 }, (_, index) => message(0, `m${index}`))
    expect(nextSessionChunkEnd(messages, 0)).toBe(500)
    expect(sizes(splitSessionMessages(messages))).toEqual([500, 1])
  })

  it('e2 part 합이 501 이 되는 메시지는 새 조각이다', () => {
    const messages = [message(250, 'a'), message(251, 'b')]
    expect(nextSessionChunkEnd(messages, 0)).toBe(1)
    expect(splitSessionMessages(messages).map(partCount)).toEqual([250, 251])
  })

  it('e3 문자 예산을 넘는 메시지는 새 조각이다', () => {
    const messages = [sized(600_000, 'a'), sized(400_001, 'b')]
    expect(nextSessionChunkEnd(messages, 0)).toBe(1)
    expect(sizes(splitSessionMessages(messages))).toEqual([1, 1])
  })

  it('e4 part 700 메시지는 혼자 한 조각이다', () => {
    const messages = [message(10, 'a'), message(700, 'big'), message(10, 'b')]
    expect(nextSessionChunkEnd(messages, 1)).toBe(2)
    expect(splitSessionMessages(messages).map(partCount)).toEqual([10, 700, 10])
  })

  it('e5 문자 1,500,000 메시지는 혼자 한 조각이다', () => {
    const messages = [sized(100, 'a'), sized(1_500_000, 'big'), sized(100, 'b')]
    expect(nextSessionChunkEnd(messages, 1)).toBe(2)
    expect(sizes(splitSessionMessages(messages))).toEqual([1, 1, 1])
  })

  it('e6 빈 입력·끝 위치는 조각이 없다', () => {
    expect(nextSessionChunkEnd([], 0)).toBe(0)
    const messages = [message(1, 'a'), message(1, 'b')]
    expect(nextSessionChunkEnd(messages, 2)).toBe(2)
    expect(splitSessionMessages([])).toEqual([])
  })

  it('e7 메시지 500 · part 500 · 문자 = 예산 꼭 맞음은 같은 조각이다', () => {
    const byCount = Array.from({ length: 500 }, (_, index) => message(1, `m${index}`))
    expect(nextSessionChunkEnd(byCount, 0)).toBe(500)
    const byParts = [message(250, 'a'), message(250, 'b'), message(0, 'c')]
    expect(nextSessionChunkEnd(byParts, 0)).toBe(3)
    const byChars = [sized(600_000, 'a'), sized(400_000, 'b'), sized(100, 'c')]
    expect(nextSessionChunkEnd(byChars, 0)).toBe(2)
  })

  it('e8 part 400 × 5,000자 메시지 측정은 예산에서 멈추고 혼자 한 조각이다', () => {
    const big: LoadedMessage = {
      role: 'assistant',
      createdAt: 1,
      parts: Array.from({ length: 400 }, (_, index) => ({
        type: 'text',
        text: `${index}`.padEnd(5_000, 'x')
      }))
    }
    const counted = countedParts(big)
    expect(nextSessionChunkEnd([counted.message, message(1, 'after')], 0)).toBe(1)
    expect(counted.reads()).toBeGreaterThan(0)
    expect(counted.reads()).toBeLessThan(400)
  })

  it('e9 한 조각 200,000건을 조립한다', () => {
    const messages = Array.from({ length: 200_000 }, (_, index) => empty(index))
    const assembled = assembleSession(head(messages, 1), [{ seq: 0, messages }])
    expect(assembled.messages).toHaveLength(200_000)
    expect(assembled.messages[199_999].createdAt).toBe(199_999)
    // vitest worker 스레드는 주 스레드보다 스택이 커서 펼침 200,000개가 통과한다 — 펼침(`push(...)`)이면
    // worker 에서도 `RangeError` 인 1,000,000개(같은 객체)도 조립한다.
    const many = new Array<LoadedMessage>(1_000_000).fill(empty(0))
    expect(assembleSession(head(many, 1), [{ seq: 0, messages: many }]).messages).toHaveLength(
      1_000_000
    )
  })

  it('e10 빈 메시지 1,001건은 조각 [500, 500, 1] 이다', () => {
    const messages = Array.from({ length: 1_001 }, (_, index) => empty(index))
    expect(sizes(splitSessionMessages(messages))).toEqual([500, 500, 1])
  })

  it('e11 part 250 메시지 10건은 조각 5개 · 각 2건이다', () => {
    const messages = Array.from({ length: 10 }, (_, index) => message(250, `m${index}`))
    expect(sizes(splitSessionMessages(messages))).toEqual([2, 2, 2, 2, 2])
  })

  it('e12 약 400,000 단위 메시지 3건은 조각 [2, 1] 이다', () => {
    const messages = [sized(400_000, 'a'), sized(400_000, 'b'), sized(400_000, 'c')]
    expect(sizes(splitSessionMessages(messages))).toEqual([2, 1])
  })

  it('estimateWireChars 는 문자열·키 길이 합 + 노드마다 2 이고 예산을 넘으면 그 합에서 멈춘다', () => {
    // {a:'xy', b:[1]} = 노드 4(객체·문자열·배열·수) × 2 + 'xy' 2 + 키 'a'·'b' 2 = 12
    expect(estimateWireChars({ a: 'xy', b: [1] })).toBe(12)
    expect(estimateWireChars('x'.repeat(10), 5)).toBe(12)
    expect(estimateWireChars({ a: 'x'.repeat(100), b: 'y'.repeat(100) }, 50)).toBeLessThan(150)
  })

  it.each([0, 1])('루트 객체가 문자 예산 %i를 넘으면 자식 값을 읽지 않는다', (limit) => {
    let childReads = 0
    const root = {
      get child() {
        childReads++
        return 'child text'
      }
    }

    const cost = estimateWireChars(root, limit)

    expect(childReads).toBe(0)
    expect(cost).toBe(2)
  })
})
