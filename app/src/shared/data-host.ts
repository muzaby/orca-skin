// 세션 본문 조각 계약 (0324 EP-4′ · MD-02 · AC15~AC17).
//
// 데이터 호스트는 세션 본문을 한 응답에 싣지 않는다. 메시지를 조각으로 나눠 창 포트에 통지로 먼저
// 보내고, 요청의 응답에는 머리(본문 없는 `LoadedSession`)와 조각 수·메시지 수만 싣는다. 같은 포트라
// 조각은 언제나 응답보다 먼저 닿는다. 받는 쪽(renderer 전송층)은 번호가 0 부터 이어지고 메시지 수가 맞을 때만
// 한 벌의 `LoadedSession` 으로 조립한다 — 조각은 전송 단위일 뿐 스토어에 들어가지 않는다(D-011).

import { z } from 'zod'
import type { LoadedMessage, LoadedSession, RefreshSessionResult } from './ipc'

// 조각 하나의 part 상한. part 가 이보다 많은 메시지 하나는 혼자 한 조각이다.
export const SESSION_CHUNK_MAX_PARTS = 500

export const SESSION_LOAD_CANCELLED = '세션 로드가 취소됐다'

// 창 → 데이터 호스트: 조각으로 받겠다는 요청 번호(창 안에서 유일).
export const SessionLoadRequestIdSchema = z.number().int().nonnegative()
export const SessionLoadCancelSchema = z.object({ requestId: SessionLoadRequestIdSchema }).strict()

// 데이터 호스트 → 창: 조각 하나.
export const SessionLoadChunkSchema = z
  .object({
    requestId: SessionLoadRequestIdSchema,
    seq: z.number().int().nonnegative(),
    messages: z.array(z.unknown())
  })
  .strict()
export interface SessionLoadChunk {
  requestId: number
  seq: number
  messages: LoadedMessage[]
}

// 응답의 머리 — 본문은 비어 있고 조각이 채운다.
export interface ChunkedSession extends LoadedSession {
  chunked: { chunks: number; messages: number }
}
export type SessionLoadReply = LoadedSession | ChunkedSession | { cancelled: true } | null
export type SessionRefreshReply =
  | Exclude<RefreshSessionResult, { status: 'updated' }>
  | { status: 'updated'; session: LoadedSession | ChunkedSession }
  | { cancelled: true }

export function splitSessionMessages(
  messages: readonly LoadedMessage[],
  maxParts = SESSION_CHUNK_MAX_PARTS
): LoadedMessage[][] {
  const chunks: LoadedMessage[][] = []
  let current: LoadedMessage[] = []
  let parts = 0
  for (const message of messages) {
    const size = message.parts.length
    if (current.length > 0 && parts + size > maxParts) {
      chunks.push(current)
      current = []
      parts = 0
    }
    current.push(message)
    parts += size
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

export function isChunkedSession(
  session: LoadedSession | ChunkedSession
): session is ChunkedSession {
  return 'chunked' in session && session.chunked !== undefined
}

// 받은 조각으로 본문을 채운다. 번호가 0 부터 이어지지 않거나 수가 어긋나면 던진다 — 일부만 조립한
// 본문을 화면에 올리지 않는다.
export function assembleSession(
  head: ChunkedSession,
  chunks: readonly Pick<SessionLoadChunk, 'seq' | 'messages'>[]
): LoadedSession {
  const { chunked, ...session } = head
  if (chunks.length !== chunked.chunks)
    throw new Error(`세션 조각 수가 다르다: ${chunks.length}/${chunked.chunks}`)
  const messages: LoadedMessage[] = []
  chunks.forEach((chunk, index) => {
    if (chunk.seq !== index) throw new Error(`세션 조각 순서가 어긋났다: ${chunk.seq}/${index}`)
    messages.push(...chunk.messages)
  })
  if (messages.length !== chunked.messages)
    throw new Error(`세션 메시지 수가 다르다: ${messages.length}/${chunked.messages}`)
  return { ...session, messages }
}
