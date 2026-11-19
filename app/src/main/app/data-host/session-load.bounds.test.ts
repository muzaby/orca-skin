// 데이터 호스트 조각 전송의 세 예산과 읽기 순서 (0325 VP-01 · VP-02 · EP-1 ⑦⑧).
//
// 리더를 바꿔 끼워 SQLite 없이 `deliver` 를 실제 전송 계약(`invokeChannel` · `fakeClient`) 위에서 부른다.
// 메시지마다 `parts` getter 와 parts 배열의 색인 읽기를 양보 전/후로 나눠 센다 — 양보 전에는 보낸 조각과
// 경계 후보 하나만 읽고, 양보 중 취소되면 그 뒤 읽기는 0 이다(D-036).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assembleSession,
  isChunkedSession,
  type SessionLoadChunk,
  type SessionLoadReply
} from '../../../shared/data-host'
import { CHANNELS, type LoadedMessage, type LoadedSession } from '../../../shared/ipc'
import { fakeClient, type FakeClient } from '../../infra/ipc/client.testfixture'
import { invokeChannel, sendChannel } from '../../infra/ipc/test-transport.testfixture'
import type { DbQueries } from '../../infra/db'
import { registerSessionLoadHandlers } from './session-load'

const reader = vi.hoisted(() => ({ session: null as LoadedSession | null }))
vi.mock('../../features/history/reader', () => ({ loadSession: () => reader.session }))

const db = { nativeHistory: { compactLegacyRaw: () => undefined } } as unknown as DbQueries
const getCwd = (): string => '/work'

const session = (messages: LoadedMessage[]): LoadedSession => ({
  id: 's1',
  backend: 'claude',
  agentKind: 'code',
  title: '제목',
  messages
})

const chunksOf = (client: FakeClient): SessionLoadChunk[] =>
  client.sent
    .filter((entry) => entry.channel === CHANNELS.sessionLoadChunk)
    .map((entry) => entry.payload as SessionLoadChunk)

beforeEach(() => {
  reader.session = null
})

describe('세션 조각 전송의 예산 (0325 VP-01)', () => {
  it('빈 parts 200,000건은 조각 400개로 가고 조립 결과가 원본과 같다', async () => {
    const messages: LoadedMessage[] = Array.from({ length: 200_000 }, (_, index) => ({
      id: String(index),
      role: index % 2 === 0 ? 'user' : 'assistant',
      createdAt: index,
      parts: []
    }))
    reader.session = session(messages)
    registerSessionLoadHandlers({ db, getCwd }, { yieldTurn: async () => undefined })
    const client = fakeClient(3)
    const reply = (await invokeChannel(
      CHANNELS.sessionLoad,
      { sessionId: 's1', requestId: 9 },
      client
    )) as SessionLoadReply
    const chunks = chunksOf(client)
    expect(chunks).toHaveLength(400)
    expect(chunks.every((chunk) => chunk.messages.length === 500)).toBe(true)
    if (!reply || 'cancelled' in reply || !isChunkedSession(reply))
      throw new Error('조각 응답이 아니다')
    const assembled = assembleSession(reply, chunks)
    expect(assembled.messages).toHaveLength(200_000)
    expect(assembled).toEqual(session(messages))
  })

  it('머리의 조각 수·메시지 수는 보낸 조각의 합이다', async () => {
    // part 300 · 0 · 300 · 빈 메시지 600 — part 경계와 메시지 수 경계가 섞인다.
    const parts = (count: number): LoadedMessage['parts'] =>
      Array.from({ length: count }, (_, index) => ({ type: 'text', text: `${index}` }))
    const messages: LoadedMessage[] = [
      { id: '0', role: 'user', createdAt: 0, parts: parts(300) },
      { id: '1', role: 'assistant', createdAt: 1, parts: parts(0) },
      { id: '2', role: 'assistant', createdAt: 2, parts: parts(300) },
      ...Array.from({ length: 600 }, (_, index) => ({
        id: String(3 + index),
        role: 'user' as const,
        createdAt: 3 + index,
        parts: []
      }))
    ]
    reader.session = session(messages)
    registerSessionLoadHandlers({ db, getCwd }, { yieldTurn: async () => undefined })
    const client = fakeClient(4)
    const reply = (await invokeChannel(
      CHANNELS.sessionLoad,
      { sessionId: 's1', requestId: 1 },
      client
    )) as SessionLoadReply
    const chunks = chunksOf(client)
    expect(chunks.map((chunk) => chunk.messages.length)).toEqual([2, 500, 101])
    expect(reply).toMatchObject({
      messages: [],
      chunked: {
        chunks: chunks.length,
        messages: chunks.reduce((sum, c) => sum + c.messages.length, 0)
      }
    })
    expect((reply as { chunked: { messages: number } }).chunked.messages).toBe(messages.length)
  })
})

// 메시지마다 `parts` getter 읽기와 parts 색인 읽기를 단계(양보 전/후)별로 센다.
function instrument(messages: LoadedMessage[]): {
  messages: LoadedMessage[]
  phase: { current: 'before' | 'after' }
  getterReads: Record<'before' | 'after', number[]>
  partReads: Record<'before' | 'after', number[]>
} {
  const phase = { current: 'before' as 'before' | 'after' }
  const getterReads = { before: messages.map(() => 0), after: messages.map(() => 0) }
  const partReads = { before: messages.map(() => 0), after: messages.map(() => 0) }
  const wrapped = messages.map((message, index) => {
    const parts = new Proxy(message.parts, {
      get(source, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) partReads[phase.current][index]++
        return Reflect.get(source, key, receiver)
      }
    })
    const { parts: _parts, ...rest } = message
    void _parts
    const out = { ...rest } as LoadedMessage
    Object.defineProperty(out, 'parts', {
      enumerable: true,
      get: () => {
        getterReads[phase.current][index]++
        return parts
      }
    })
    return out
  })
  return { messages: wrapped, phase, getterReads, partReads }
}

const textParts = (count: number, chars: number): LoadedMessage['parts'] =>
  Array.from({ length: count }, (_, index) => ({
    type: 'text',
    text: `${index}`.padEnd(chars, 'x')
  }))

describe('조각 전송의 읽기 순서 (0325 VP-02 자리 7 · D-036)', () => {
  it.each([
    {
      name: 'q1 메시지 수 경계 — 빈 메시지 600건',
      messages: (): LoadedMessage[] =>
        Array.from({ length: 600 }, (_, index) => ({
          id: String(index),
          role: 'user',
          createdAt: index,
          parts: []
        })),
      firstChunk: 500,
      check: (m: ReturnType<typeof instrument>): void => {
        // 후보(index 500)를 읽지 않는다.
        expect(m.getterReads.before[500]).toBe(0)
        expect(m.getterReads.before.slice(500).every((count) => count === 0)).toBe(true)
      }
    },
    {
      name: 'q2 part 경계 — part 300 메시지 4건',
      messages: (): LoadedMessage[] =>
        Array.from({ length: 4 }, (_, index) => ({
          id: String(index),
          role: 'assistant',
          createdAt: index,
          parts: textParts(300, 1)
        })),
      firstChunk: 1,
      check: (m: ReturnType<typeof instrument>): void => {
        expect(m.getterReads.before[1]).toBeGreaterThan(0)
        expect(m.getterReads.before.slice(2).every((count) => count === 0)).toBe(true)
      }
    },
    {
      name: 'q3 문자 경계 — 10,000자 part 40개 메시지 4건',
      messages: (): LoadedMessage[] =>
        Array.from({ length: 4 }, (_, index) => ({
          id: String(index),
          role: 'assistant',
          createdAt: index,
          parts: textParts(40, 10_000)
        })),
      firstChunk: 2,
      check: (m: ReturnType<typeof instrument>): void => {
        // 후보(index 2)는 남은 예산까지만 잰다.
        expect(m.partReads.before[2]).toBeGreaterThan(0)
        expect(m.partReads.before[2]).toBeLessThan(40)
        expect(m.getterReads.before[3]).toBe(0)
        expect(m.partReads.before[3]).toBe(0)
      }
    }
  ])(
    '양보 전에는 조각과 경계 후보만 읽고 양보 중 취소면 그 뒤 읽기는 0 이다 — $name',
    async ({ messages, firstChunk, check }) => {
      const m = instrument(messages())
      reader.session = session(m.messages)
      const client = fakeClient(5)
      registerSessionLoadHandlers(
        { db, getCwd },
        {
          // 양보 중에 취소 통지가 닿는다.
          yieldTurn: async () => {
            m.phase.current = 'after'
            sendChannel(CHANNELS.sessionLoadCancel, { requestId: 2 }, client)
          }
        }
      )
      const reply = await invokeChannel(
        CHANNELS.sessionLoad,
        { sessionId: 's1', requestId: 2 },
        client
      )
      expect(reply).toEqual({ cancelled: true })
      const chunks = chunksOf(client)
      expect(chunks).toHaveLength(1)
      expect(chunks[0].messages).toHaveLength(firstChunk)
      check(m)
      expect(m.getterReads.after.every((count) => count === 0)).toBe(true)
      expect(m.partReads.after.every((count) => count === 0)).toBe(true)
    }
  )
})
