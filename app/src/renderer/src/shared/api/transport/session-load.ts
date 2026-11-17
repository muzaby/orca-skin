// 세션 본문 조각의 조립 — 창 쪽 renderer 전송층 (0324 EP-4′ · AC15~AC17 · D-058).
//
// 요청마다 번호를 붙여 보내고, 그 번호의 조각 통지를 모았다가 응답(머리)이 오면 한 벌로 조립해 돌려준다.
// `window.oo.session.load`·`refresh` 의 반환 형상은 그대로다 — renderer 는 조각을 보지 않는다(D-011).
// 취소한 요청의 늦은 조각은 버리고, 그 호출은 거부로 끝난다.

import {
  assembleSession,
  isChunkedSession,
  SESSION_LOAD_CANCELLED,
  SessionLoadChunkSchema,
  type SessionLoadChunk,
  type SessionLoadReply,
  type SessionRefreshReply
} from '../../../../../shared/data-host'
import type { LoadedSession, RefreshSessionResult } from '../../../../../shared/ipc'

export interface SessionLoadClientDeps {
  invoke(channel: string, payload: unknown): Promise<unknown>
  send(channel: string, payload: unknown): void
  subscribe(channel: string, handler: (payload: unknown) => void): () => void
  channels: { load: string; refresh: string; chunk: string; cancel: string }
}

export interface SessionLoadClient {
  load(sessionId: string): Promise<LoadedSession | null>
  refresh(sessionId: string): Promise<RefreshSessionResult>
  // 그 세션의 진행 중 본문 로드를 취소한다(갱신은 그대로 둔다).
  cancelLoad(sessionId: string): void
}

interface Pending {
  sessionId: string
  kind: 'load' | 'refresh'
  chunks: SessionLoadChunk[]
  cancelled: boolean
}

export function createSessionLoadClient(deps: SessionLoadClientDeps): SessionLoadClient {
  const pending = new Map<number, Pending>()
  let nextId = 0

  deps.subscribe(deps.channels.chunk, (payload) => {
    const parsed = SessionLoadChunkSchema.safeParse(payload)
    if (!parsed.success) return
    const request = pending.get(parsed.data.requestId)
    // 취소했거나 이미 끝난 요청의 조각은 버린다.
    if (!request || request.cancelled) return
    request.chunks.push(parsed.data as SessionLoadChunk)
  })

  const settle = (request: Pending, session: LoadedSession): LoadedSession =>
    isChunkedSession(session) ? assembleSession(session, request.chunks) : session

  async function run<R>(
    kind: Pending['kind'],
    sessionId: string,
    finish: (reply: unknown, request: Pending) => R
  ): Promise<R> {
    const requestId = nextId++
    const request: Pending = { sessionId, kind, chunks: [], cancelled: false }
    pending.set(requestId, request)
    try {
      const reply = await deps.invoke(deps.channels[kind], { sessionId, requestId })
      if (
        request.cancelled ||
        (reply !== null && typeof reply === 'object' && 'cancelled' in reply)
      )
        throw new Error(SESSION_LOAD_CANCELLED)
      return finish(reply, request)
    } finally {
      pending.delete(requestId)
    }
  }

  return {
    load: (sessionId) =>
      run('load', sessionId, (reply, request) => {
        const session = reply as Exclude<SessionLoadReply, { cancelled: true }>
        return session ? settle(request, session) : null
      }),
    refresh: (sessionId) =>
      run('refresh', sessionId, (reply, request) => {
        const result = reply as Exclude<SessionRefreshReply, { cancelled: true }>
        return result.status === 'updated'
          ? { status: 'updated', session: settle(request, result.session) }
          : result
      }),
    cancelLoad: (sessionId) => {
      for (const [requestId, request] of pending) {
        if (request.sessionId !== sessionId || request.kind !== 'load' || request.cancelled)
          continue
        request.cancelled = true
        request.chunks = []
        deps.send(deps.channels.cancel, { requestId })
      }
    }
  }
}
