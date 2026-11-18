// 세션 본문 조각 계약 (0324 EP-4′ · MD-02 · AC15~AC17).
//
// 데이터 호스트는 세션 본문을 한 응답에 싣지 않는다. 메시지를 조각으로 나눠 창 포트에 통지로 먼저
// 보내고, 요청의 응답에는 머리(본문 없는 `LoadedSession`)와 조각 수·메시지 수만 싣는다. 같은 포트라
// 조각은 언제나 응답보다 먼저 닿는다. 받는 쪽(renderer 전송층)은 번호가 0 부터 이어지고 메시지 수가 맞을 때만
// 한 벌의 `LoadedSession` 으로 조립한다 — 조각은 전송 단위일 뿐 스토어에 들어가지 않는다(D-011).

import { z } from 'zod'
import type { LoadedMessage, LoadedSession, RefreshSessionResult } from './ipc'

// 조각 하나의 상한 셋 (0325 D-007 · EP-1). 셋 중 하나라도 넘는 메시지 하나는 혼자 한 조각이다.
// part 만 세면 part 0 메시지가 한 조각에 끝없이 든다 — 메시지 수와 직렬화 근사 문자도 함께 센다.
export const SESSION_CHUNK_MAX_MESSAGES = 500
export const SESSION_CHUNK_MAX_PARTS = 500
// `estimateWireChars` 단위(문자열 값·키 길이 합 + 노드마다 2)다. 실제 복제 바이트와 다르다(0325 B2).
export const SESSION_CHUNK_MAX_CHARS = 1_000_000

export interface SessionChunkLimits {
  messages: number
  parts: number
  chars: number
}

export const SESSION_CHUNK_LIMITS: SessionChunkLimits = {
  messages: SESSION_CHUNK_MAX_MESSAGES,
  parts: SESSION_CHUNK_MAX_PARTS,
  chars: SESSION_CHUNK_MAX_CHARS
}

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

// 값의 직렬화 크기 근사 — 문자열 값·객체 키 길이 합 + 노드마다 2. 합이 `limit` 을 넘는 순간 그 합을
// 돌려준다(남은 값은 읽지 않는다). 재귀 대신 명시 스택이고, 배열·객체는 자식을 하나씩 꺼내 읽는다 —
// 미리 펼치면 예산을 넘긴 뒤의 자식까지 읽는다(0325 EP-1 ⑤ · AC2).
export function estimateWireChars(value: unknown, limit = Number.POSITIVE_INFINITY): number {
  interface Frame {
    source: unknown
    keys: readonly string[] | null
    size: number
    index: number
  }
  const stack: Frame[] = []
  let total = 0
  const visit = (node: unknown): boolean => {
    total += 2
    if (typeof node === 'string') total += node.length
    else if (node !== null && typeof node === 'object') {
      if (Array.isArray(node)) stack.push({ source: node, keys: null, size: node.length, index: 0 })
      else {
        const keys = Object.keys(node)
        stack.push({ source: node, keys, size: keys.length, index: 0 })
      }
    }
    return total > limit
  }
  if (visit(value)) return total
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (frame.index >= frame.size) {
      stack.pop()
      continue
    }
    const index = frame.index++
    let child: unknown
    if (frame.keys) {
      const key = frame.keys[index]
      total += key.length
      child = (frame.source as Record<string, unknown>)[key]
    } else child = (frame.source as readonly unknown[])[index]
    if (visit(child)) return total
  }
  return total
}

// `start` 에서 시작하는 조각의 끝(제외) 색인 (0325 EP-1 ①~⑤ · D-036). 읽는 메시지는 그 조각과 경계
// 후보 하나뿐이다 — 메시지 수 경계는 후보를 읽지 않고, part·문자 경계는 후보를 남은 예산까지만 잰다.
export function nextSessionChunkEnd(
  messages: readonly LoadedMessage[],
  start: number,
  limits: SessionChunkLimits = SESSION_CHUNK_LIMITS
): number {
  let end = start
  let parts = 0
  let chars = 0
  while (end < messages.length) {
    // ① 메시지 수 — 후보를 읽기 전에 닫는다.
    if (end - start >= limits.messages) break
    const message = messages[end]
    const size = message.parts.length
    // ② part 합 — 첫 메시지는 넘어도 들어간다(④).
    if (end > start && parts + size > limits.parts) break
    // ③ 문자 예산 — 남은 예산까지만 잰다.
    const remaining = limits.chars - chars
    const cost = estimateWireChars(message, remaining)
    if (cost > remaining) {
      // ④ 첫 메시지는 혼자 한 조각이다 — 빈 조각을 만들지 않는다.
      if (end === start) return start + 1
      break
    }
    parts += size
    chars += cost
    end += 1
  }
  return end
}

export function splitSessionMessages(
  messages: readonly LoadedMessage[],
  limits: SessionChunkLimits = SESSION_CHUNK_LIMITS
): LoadedMessage[][] {
  const chunks: LoadedMessage[][] = []
  for (let start = 0; start < messages.length;) {
    const end = nextSessionChunkEnd(messages, start, limits)
    chunks.push(messages.slice(start, end))
    start = end
  }
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
  // 조각 크기와 무관하게 조립한다 — 인자 펼침(`push(...chunk)`)은 큰 조각에서 `RangeError` 다(0325 R1).
  chunks.forEach((chunk, index) => {
    if (chunk.seq !== index) throw new Error(`세션 조각 순서가 어긋났다: ${chunk.seq}/${index}`)
    for (const message of chunk.messages) messages.push(message)
  })
  if (messages.length !== chunked.messages)
    throw new Error(`세션 메시지 수가 다르다: ${messages.length}/${chunked.messages}`)
  return { ...session, messages }
}
