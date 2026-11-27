import {
  HISTORY_BODY_BYTES,
  type HistoryBodyRef,
  type HistoryPageReply,
  type HistoryQuery
} from '../../../../../../shared/history-page'
import type { AppMessagePart } from '../../../../../../shared/ipc'
import { computeClient } from '../../../../shared/compute/client'
import { rememberHistoryLayout } from '../../../../shared/markdown/historyLayout'
import type { ComputeResults, HistoryBodyRequest } from '../../../../shared/compute/protocol'
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

let bodySequence = 0

export async function readDeferredParts(
  ref: HistoryBodyRef,
  openGeneration: number,
  page: (query: HistoryQuery) => Promise<HistoryPageReply>,
  current: () => boolean,
  signal?: AbortSignal
): Promise<AppMessagePart[]> {
  const sequence = ++bodySequence
  const request = (packet: HistoryBodyRequest['packet']) =>
    computeClient().request<'historyBody'>(
      { kind: 'historyBody', sequence, bytes: ref.bytes, packet },
      { cacheable: false }
    )
  let offset = 0
  let job: ReturnType<typeof request> | undefined
  let completed = false
  let started = false
  let result: ComputeResults['historyBody'] | undefined
  const cancel = (): void => job?.cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    while (offset < ref.bytes && current() && !signal?.aborted) {
      const reply = await page({
        kind: 'body',
        sessionId: ref.session,
        ref,
        openGeneration,
        offset
      })
      if (
        !current() ||
        signal?.aborted ||
        reply.status !== 'body' ||
        reply.sessionId !== ref.session ||
        reply.openGeneration !== openGeneration ||
        reply.offset !== offset
      )
        throw Error('Stale history body')
      const bytes = reply.nextOffset - offset
      const padding = reply.base64.endsWith('==') ? 2 : reply.base64.endsWith('=') ? 1 : 0
      if (
        bytes <= 0 ||
        bytes > HISTORY_BODY_BYTES ||
        reply.base64.length !== 4 * Math.ceil(bytes / 3) ||
        (reply.base64.length * 3) / 4 - padding !== bytes ||
        reply.nextOffset > ref.bytes ||
        reply.done !== (reply.nextOffset === ref.bytes)
      )
        throw Error('Invalid history body range')

      started = true
      job = request({ offset, base64: reply.base64 })
      result = await job.promise
      job = undefined
      if (result.nextOffset !== reply.nextOffset)
        throw Error('Invalid history body acknowledgement')
      offset = result.nextOffset
    }
    if (!result || !current() || signal?.aborted || offset !== ref.bytes)
      throw Error('Incomplete history body')
    completed = true
    for (const { index, segments } of result.layouts ?? []) {
      const part = result.parts[index]
      if (part?.type === 'text' || part?.type === 'reasoning')
        rememberHistoryLayout(part, part.text, segments)
    }
    return result.parts
  } finally {
    signal?.removeEventListener('abort', cancel)
    if (started && !completed) void request(null).promise.catch(() => {})
  }
}
