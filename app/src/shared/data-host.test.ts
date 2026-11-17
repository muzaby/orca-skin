// 세션 본문 조각의 분할·조립 (0324 EP-6 규칙 칸 · AC16).
import { describe, expect, it } from 'vitest'
import {
  assembleSession,
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
