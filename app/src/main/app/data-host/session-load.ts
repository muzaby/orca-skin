// 세션 본문 전송 — 데이터 호스트 (0324 EP-4′ · AC15~AC17 · AC19′).
//
// `oo:session:load`·`oo:session:refresh` 는 본문을 응답에 싣지 않는다. 요청이 번호(`requestId`)를
// 가지면 메시지를 조각으로 나눠 요청한 창의 포트에 통지로 보내고, 응답에는 머리와 조각 수만 싣는다
// (`shared/data-host.ts`). 조각 사이에는 매크로태스크 하나를 양보한다 — 그 사이에 취소 통지와 턴 저장
// 입력(B25)이 끼어든다. 취소된 요청은 다음 조각부터 보내지 않는다.
//
// 활동 상태는 에이전트 호스트에 묻는다(없으면 쉬는 상태 — 호출자가 훅으로 정한다). 갱신의 원본 읽기도
// 훅(`refreshHistory`)이 에이전트 호스트에 부탁한다.
//
// `loadSession` 을 부르는 자리는 이 파일과 턴 준비의 복구 읽기(`loadSessionArchive`)뿐이다(가드 (c)).

import { CHANNELS, type ChatActivitySnapshot, type LoadedSession } from '../../../shared/ipc'
import {
  SessionLoadCancelSchema,
  splitSessionMessages,
  type SessionLoadChunk,
  type SessionLoadReply,
  type SessionRefreshReply
} from '../../../shared/data-host'
import { LoadSessionRequestSchema } from '../../../shared/protocol'
import type { NativeSyncResult } from '../../features/history/native-sync'
import { loadSession } from '../../features/history/reader'
import type { DbQueries } from '../../infra/db'
import { handle, on } from '../../infra/ipc/handle'
import type { RequestEvent } from '../../infra/ipc/transport'

export interface SessionLoadContext {
  db: DbQueries
  getCwd(projectId?: string | null): string
}

export interface SessionLoadHooks {
  getActivity?: (sessionId: string) => ChatActivitySnapshot | Promise<ChatActivitySnapshot>
  refreshHistory?: (sessionId: string) => Promise<NativeSyncResult | undefined>
  // 조각 사이의 양보 — 테스트가 바꿔 끼운다.
  yieldTurn?: () => Promise<void>
}

const yieldMacrotask = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

// 턴 준비의 복구 읽기 — 실행 쪽이 `data.query.loadSessionArchive` 로 부른다.
export function loadSessionArchive(
  db: DbQueries,
  sessionId: string,
  cwdOf: (projectId?: string | null) => string
): LoadedSession | null {
  return loadSession(db, sessionId, cwdOf)
}

export function registerSessionLoadHandlers(
  ctx: SessionLoadContext,
  hooks: SessionLoadHooks = {}
): void {
  const yieldTurn = hooks.yieldTurn ?? yieldMacrotask
  // 진행 중인 조각 전송 — 창마다 요청 번호. 취소 통지는 여기서 지운다.
  const sending = new Map<number, Set<number>>()

  const withActivity = async (session: LoadedSession): Promise<LoadedSession> => ({
    ...session,
    ...(hooks.getActivity ? { activity: await hooks.getActivity(session.id) } : {})
  })

  // 본문을 조각으로 보낸다. 취소되면 `{ cancelled: true }`.
  const deliver = async (
    event: RequestEvent,
    requestId: number | undefined,
    session: LoadedSession
  ): Promise<SessionLoadReply> => {
    // 번호 없는 요청은 통째로 답한다 — 조각을 조립할 받는 쪽이 없다.
    if (requestId === undefined) return session
    const client = event.sender
    const chunks = splitSessionMessages(session.messages)
    const active = sending.get(client.id) ?? new Set<number>()
    sending.set(client.id, active)
    active.add(requestId)
    try {
      for (let seq = 0; seq < chunks.length; seq++) {
        if (seq > 0) await yieldTurn()
        if (!active.has(requestId) || client.isClosed()) return { cancelled: true }
        const chunk: SessionLoadChunk = { requestId, seq, messages: chunks[seq] }
        client.send(CHANNELS.sessionLoadChunk, chunk)
      }
      return {
        ...session,
        messages: [],
        chunked: { chunks: chunks.length, messages: session.messages.length }
      }
    } finally {
      active.delete(requestId)
      if (active.size === 0) sending.delete(client.id)
    }
  }

  on(CHANNELS.sessionLoadCancel, SessionLoadCancelSchema, ({ requestId }, event) => {
    sending.get(event.sender.id)?.delete(requestId)
  })

  handle(
    CHANNELS.sessionLoad,
    LoadSessionRequestSchema,
    { fallback: null },
    async (req, event): Promise<SessionLoadReply> => {
      ctx.db.nativeHistory.compactLegacyRaw(req.sessionId)
      const session = loadSession(ctx.db, req.sessionId, (projectId) => ctx.getCwd(projectId))
      if (!session) return null
      return deliver(event, req.requestId, await withActivity(session))
    }
  )

  handle(
    CHANNELS.sessionRefresh,
    LoadSessionRequestSchema,
    {
      fallback: { status: 'unavailable' as const, message: '대화 갱신 요청이 올바르지 않습니다.' }
    },
    async (req, event): Promise<SessionRefreshReply> => {
      const sync = await hooks.refreshHistory?.(req.sessionId)
      if (!sync || sync.status === 'unchanged') return { status: 'unchanged' }
      if (sync.status === 'busy') return { status: 'busy' }
      if (sync.status !== 'ready')
        return { status: sync.status, message: sync.message ?? '원본 대화를 확인할 수 없습니다.' }
      const session = loadSession(
        ctx.db,
        req.sessionId,
        (projectId) => ctx.getCwd(projectId),
        sync.snapshot
      )
      if (!session) return { status: 'missing', message: '목록에서 제거된 대화입니다.' }
      const delivered = await deliver(event, req.requestId, await withActivity(session))
      if (!delivered || 'cancelled' in delivered) return { cancelled: true }
      return { status: 'updated', session: delivered }
    }
  )
}
