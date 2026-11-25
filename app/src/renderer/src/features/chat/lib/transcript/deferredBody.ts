import {
  HISTORY_BODY_BYTES,
  type HistoryBodyRef,
  type HistoryPageReply,
  type HistoryQuery
} from '../../../../../../shared/history-page'
import type { AppMessagePart } from '../../../../../../shared/ipc'
import type { Message } from '../../reducer/chatReducer'

export interface DeferredBlock {
  kind: 'deferred'
  key: string
  messageId: string
  ref: HistoryBodyRef
  gap: 0 | 8 | 16 | 24
}

export function deferredBlock(ref: HistoryBodyRef, first: boolean): DeferredBlock {
  return {
    kind: 'deferred',
    key: ref.message + ':deferred',
    messageId: ref.message,
    ref,
    gap: first ? 0 : 16
  }
}

// Each deferred message interrupts cross-message text and tool grouping.
export function splitDeferred<T>(
  messages: readonly Message[],
  render: (part: Message[], last: boolean) => T[],
  placeholder: (ref: HistoryBodyRef) => T
): T[] {
  const result: T[] = []
  let start = 0
  messages.forEach((message, index) => {
    if (!message.deferredBody) return
    if (index > start) result.push(...render(messages.slice(start, index), false))
    result.push(placeholder(message.deferredBody))
    start = index + 1
  })
  if (start < messages.length) result.push(...render(messages.slice(start), true))
  return result
}

export async function readDeferredParts(
  ref: HistoryBodyRef,
  openGeneration: number,
  page: (query: HistoryQuery) => Promise<HistoryPageReply>,
  current: () => boolean
): Promise<AppMessagePart[]> {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const strings: string[] = []
  let offset = 0
  while (offset < ref.bytes && current()) {
    const reply = await page({ kind: 'body', sessionId: ref.session, ref, openGeneration, offset })
    if (
      !current() ||
      reply.status !== 'body' ||
      reply.sessionId !== ref.session ||
      reply.openGeneration !== openGeneration ||
      reply.offset !== offset
    )
      throw Error('Stale history body')
    const raw = atob(reply.base64)
    if (
      !raw.length ||
      raw.length > HISTORY_BODY_BYTES ||
      reply.nextOffset !== offset + raw.length ||
      reply.nextOffset > ref.bytes ||
      reply.done !== (reply.nextOffset === ref.bytes)
    )
      throw Error('Invalid history body range')
    strings.push(
      decoder.decode(
        Uint8Array.from(raw, (char) => char.charCodeAt(0)),
        { stream: !reply.done }
      )
    )
    offset = reply.nextOffset
  }
  if (!current() || offset !== ref.bytes) throw Error('Incomplete history body')
  const parts: unknown = JSON.parse(strings.join(''))
  if (!Array.isArray(parts) || !parts.every((part) => part && typeof part.type === 'string'))
    throw Error('Invalid history body')
  return parts
}
