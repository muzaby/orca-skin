// 데이터 호스트의 세션 본문 전송 (0324 EP-4′ · AC15~AC17 · AC19′).
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assembleSession,
  isChunkedSession,
  SESSION_CHUNK_MAX_PARTS,
  type SessionLoadChunk,
  type SessionLoadReply,
  type SessionRefreshReply
} from '../../../shared/data-host'
import { CHANNELS, type ChatActivitySnapshot, type LoadedSession } from '../../../shared/ipc'
import type { NativeHistorySnapshot } from '../../adapters/common/native-history'
import { refreshNativeHistory } from '../../features/history/native-sync'
import { loadSession } from '../../features/history/reader'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { registerSessionLoadHandlers, type SessionLoadHooks } from './session-load'

type Sender = { id: number; send: (channel: string, payload: unknown) => void; isClosed: () => boolean }
type Callback = (request: unknown, event: { sender: Sender }) => unknown
const registered = vi.hoisted(() => ({
  handlers: new Map<string, (request: never, event: never) => unknown>(),
  listeners: new Map<string, (request: never, event: never) => void>()
}))
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    _schema: unknown,
    _mode: unknown,
    callback: (request: never, event: never) => unknown
  ) => registered.handlers.set(channel, callback),
  on: (channel: string, _schema: unknown, callback: (request: never, event: never) => void) =>
    registered.listeners.set(channel, callback)
}))

let db: Database.Database
let queries: DbQueries
const cwd = (projectId?: string | null): string => `/fallback/${projectId ?? 'default'}`

beforeEach(() => {
  registered.handlers.clear()
  registered.listeners.clear()
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  queries = new DbQueries(db)
})
afterEach(() => db.close())

function seed(id: string, messages: number, partsPerMessage: number): void {
  queries.insertSession({
    id,
    backend: 'claude',
    title: `제목-${id}`,
    projectId: null,
    createdAt: 1,
    providerKey: 'claude-local',
    cwd: `/work/${id}`
  })
  for (let m = 0; m < messages; m++) {
    const messageId = queries.appendMessage({
      sessionId: id,
      role: m % 2 === 0 ? 'user' : 'assistant',
      content: '',
      createdAt: 10 + m,
      complete: 1
    })
    for (let p = 0; p < partsPerMessage; p++) {
      queries.appendPart({
        messageId,
        type: 'text',
        toolRunId: null,
        payloadJson: JSON.stringify({ text: `${id}-${m}-${p}` })
      })
    }
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function client(id = 7) {
  const chunks: SessionLoadChunk[] = []
  const events: string[] = []
  const sender: Sender = {
    id,
    send: (channel, payload) => {
      expect(channel).toBe(CHANNELS.sessionLoadChunk)
      chunks.push(payload as SessionLoadChunk)
      events.push(`chunk:${(payload as SessionLoadChunk).seq}`)
    },
    isClosed: () => false
  }
  return { sender, chunks, events }
}

const call = (channel: string, request: unknown, sender: Sender): Promise<unknown> =>
  Promise.resolve((registered.handlers.get(channel) as unknown as Callback)(request, { sender }))

function assemble(reply: SessionLoadReply, chunks: SessionLoadChunk[]): LoadedSession | null {
  if (!reply) return null
  if ('cancelled' in reply) throw new Error('취소된 응답')
  return isChunkedSession(reply) ? assembleSession(reply, chunks) : reply
}

describe('세션 본문은 조각으로 가고 조립 결과는 `loadSession` 과 같다 (AC15)', () => {
  it.each([
    ['조각 하나에 드는 세션', 4, 3, 1],
    ['조각 셋으로 나뉘는 세션', 120, 10, 3],
    ['메시지 없는 세션', 0, 0, 0]
  ])('%s', async (_name, messages, parts, expectedChunks) => {
    seed('s1', messages, parts)
    registerSessionLoadHandlers({ db: queries, getCwd: cwd })
    const c = client()
    const reply = (await call(
      CHANNELS.sessionLoad,
      { sessionId: 's1', requestId: 3 },
      c.sender
    )) as SessionLoadReply
    expect(c.chunks.map((chunk) => [chunk.requestId, chunk.seq])).toEqual(
      Array.from({ length: expectedChunks }, (_, seq) => [3, seq])
    )
    for (const chunk of c.chunks) {
      const size = chunk.messages.reduce((sum, message) => sum + message.parts.length, 0)
      expect(size).toBeLessThanOrEqual(SESSION_CHUNK_MAX_PARTS)
    }
    // 응답 자체에는 본문이 없다.
    expect((reply as LoadedSession).messages).toEqual([])
    expect(assemble(reply, c.chunks)).toEqual(loadSession(queries, 's1', cwd))
  })

  it('네이티브 이력이 있는 세션도 같다', async () => {
    seed('native', 2, 1)
    const snapshot: NativeHistorySnapshot = {
      sessionId: 'native',
      cwd: '/work/native',
      sourceKey: 'root',
      revision: 'r1',
      messages: [
        { id: 'n1', role: 'user', createdAt: 1, parts: [{ type: 'text', text: '원본 질문' }] },
        { id: 'n2', role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: '원본 답' }] }
      ]
    }
    expect(
      await refreshNativeHistory('native', {
        db: queries,
        isBusy: () => false,
        read: async () => ({ status: 'ready', snapshot })
      })
    ).toMatchObject({ status: 'ready' })
    registerSessionLoadHandlers({ db: queries, getCwd: cwd })
    const c = client()
    const reply = (await call(
      CHANNELS.sessionLoad,
      { sessionId: 'native', requestId: 0 },
      c.sender
    )) as SessionLoadReply
    const expected = loadSession(queries, 'native', cwd)
    expect(expected?.messages.length).toBeGreaterThan(0)
    expect(assemble(reply, c.chunks)).toEqual(expected)
  })

  it('없는 id 는 `null` 이고 조각을 보내지 않는다', async () => {
    registerSessionLoadHandlers({ db: queries, getCwd: cwd })
    const c = client()
    expect(await call(CHANNELS.sessionLoad, { sessionId: '없음', requestId: 1 }, c.sender)).toBeNull()
    expect(c.chunks).toEqual([])
  })

  it('번호 없는 요청은 통째로 답한다', async () => {
    seed('s1', 120, 10)
    registerSessionLoadHandlers({ db: queries, getCwd: cwd })
    const c = client()
    expect(await call(CHANNELS.sessionLoad, { sessionId: 's1' }, c.sender)).toEqual(
      loadSession(queries, 's1', cwd)
    )
    expect(c.chunks).toEqual([])
  })
})

describe('조각 사이 양보와 취소 (AC17)', () => {
  it('조각 사이마다 한 번 양보하고, 첫 조각 앞에서는 양보하지 않는다', async () => {
    seed('s1', 120, 10)
    const c = client()
    const yieldTurn = vi.fn(async () => {
      c.events.push('yield')
    })
    registerSessionLoadHandlers({ db: queries, getCwd: cwd }, { yieldTurn })
    await call(CHANNELS.sessionLoad, { sessionId: 's1', requestId: 0 }, c.sender)
    expect(c.events).toEqual(['chunk:0', 'yield', 'chunk:1', 'yield', 'chunk:2'])
  })

  it('조각 1 뒤에 취소하면 조각 2 부터 보내지 않고 취소로 답한다', async () => {
    seed('s1', 120, 10)
    const c = client()
    const cancel = (requestId: number, sender = c.sender): void =>
      (registered.listeners.get(CHANNELS.sessionLoadCancel) as unknown as Callback)(
        { requestId },
        { sender }
      ) as void
    const yieldTurn = vi.fn(async () => {
      // 다른 창의 같은 번호 · 이 창의 다른 번호는 이 전송을 멈추지 않는다.
      cancel(0, client(99).sender)
      cancel(5)
      if (c.chunks.length === 2) cancel(0)
    })
    registerSessionLoadHandlers({ db: queries, getCwd: cwd }, { yieldTurn })
    expect(await call(CHANNELS.sessionLoad, { sessionId: 's1', requestId: 0 }, c.sender)).toEqual({
      cancelled: true
    })
    expect(c.chunks.map((chunk) => chunk.seq)).toEqual([0, 1])
  })

  it('창 포트가 닫히면 남은 조각을 보내지 않는다', async () => {
    seed('s1', 120, 10)
    const c = client()
    let closed = false
    c.sender.isClosed = () => closed
    registerSessionLoadHandlers(
      { db: queries, getCwd: cwd },
      {
        yieldTurn: async () => {
          closed = true
        }
      }
    )
    expect(await call(CHANNELS.sessionLoad, { sessionId: 's1', requestId: 0 }, c.sender)).toEqual({
      cancelled: true
    })
    expect(c.chunks.map((chunk) => chunk.seq)).toEqual([0])
  })
})

describe('활동 상태와 갱신 (AC19′)', () => {
  const activity = (sessionId: string, foreground: string): ChatActivitySnapshot =>
    ({ type: 'chat.activity', sessionId, foreground }) as unknown as ChatActivitySnapshot

  it('에이전트 호스트가 답한 활동 상태를 머리에 싣는다', async () => {
    seed('s1', 2, 1)
    const hooks: SessionLoadHooks = { getActivity: async (id) => activity(id, 'streaming') }
    registerSessionLoadHandlers({ db: queries, getCwd: cwd }, hooks)
    const c = client()
    const reply = (await call(
      CHANNELS.sessionLoad,
      { sessionId: 's1', requestId: 0 },
      c.sender
    )) as LoadedSession
    expect(reply.activity).toEqual(activity('s1', 'streaming'))
    expect(assemble(reply, c.chunks)).toEqual({
      ...loadSession(queries, 's1', cwd),
      activity: activity('s1', 'streaming')
    })
  })

  it('갱신은 원본 읽기를 한 번 부탁한 뒤 그 스냅샷의 본문을 조각으로 보낸다', async () => {
    seed('s1', 2, 1)
    const snapshot: NativeHistorySnapshot = {
      sessionId: 's1',
      cwd: '/work/s1',
      sourceKey: 'root',
      revision: 'r2',
      messages: [
        { id: 'n1', role: 'user', createdAt: 1, parts: [{ type: 'text', text: '갱신된 질문' }] }
      ]
    }
    const order: string[] = []
    const refreshHistory = vi.fn(async (sessionId: string) => {
      order.push('refresh')
      return refreshNativeHistory(sessionId, {
        db: queries,
        isBusy: () => false,
        read: async () => ({ status: 'ready', snapshot })
      })
    })
    registerSessionLoadHandlers({ db: queries, getCwd: cwd }, { refreshHistory })
    const c = client()
    c.sender.send = (_channel, payload) => {
      order.push('chunk')
      c.chunks.push(payload as SessionLoadChunk)
    }
    const reply = (await call(
      CHANNELS.sessionRefresh,
      { sessionId: 's1', requestId: 4 },
      c.sender
    )) as SessionRefreshReply
    expect(refreshHistory).toHaveBeenCalledExactlyOnceWith('s1')
    expect(order).toEqual(['refresh', 'chunk'])
    if (!('status' in reply) || reply.status !== 'updated') throw new Error('updated 가 아니다')
    const assembled = assemble(reply.session, c.chunks)
    expect(assembled).toEqual(loadSession(queries, 's1', cwd, snapshot))
    expect(JSON.stringify(assembled?.messages)).toContain('갱신된 질문')
  })

  it.each([
    [undefined, { status: 'unchanged' }],
    [{ status: 'busy' }, { status: 'busy' }],
    [
      { status: 'unavailable', message: '원본 없음' },
      { status: 'unavailable', message: '원본 없음' }
    ]
  ])('갱신 결과 %j 는 본문 없이 %j 로 답한다', async (sync, expected) => {
    seed('s1', 2, 1)
    registerSessionLoadHandlers(
      { db: queries, getCwd: cwd },
      { refreshHistory: async () => sync as never }
    )
    const c = client()
    expect(await call(CHANNELS.sessionRefresh, { sessionId: 's1', requestId: 0 }, c.sender)).toEqual(
      expected
    )
    expect(c.chunks).toEqual([])
  })
})
