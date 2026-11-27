import {
  HISTORY_BODY_BYTES,
  type HistoryBodyRef,
  type HistoryPageReply,
  type HistoryQuery
} from '../../../../../../shared/history-page'
import { SESSION_LOAD_CANCELLED } from '../../../../../../shared/data-host'
import type { AppMessagePart } from '../../../../../../shared/ipc'
import {
  computeClient,
  isComputeWorkerFailure,
  type ComputeHandle
} from '../../../../shared/compute/client'
import { rendererLog } from '../../../../shared/logging'
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

export type HistoryBodyFailureReason =
  'stale' | 'invalid' | 'unavailable' | 'cancelled' | 'worker' | 'churn' | 'transport'

export class HistoryBodyFailure extends Error {
  constructor(
    readonly reason: HistoryBodyFailureReason,
    message: string,
    readonly recoveryEpoch?: number
  ) {
    super(message)
  }
}

async function readBodyChunk(
  page: (query: HistoryQuery) => Promise<HistoryPageReply>,
  ref: HistoryBodyRef,
  openGeneration: number,
  offset: number,
  checkCurrent: (message: string) => void
): Promise<Extract<HistoryPageReply, { status: 'body' }>> {
  let reply: HistoryPageReply
  try {
    reply = await page({ kind: 'body', sessionId: ref.session, ref, openGeneration, offset })
  } catch (error) {
    checkCurrent('Stale history body')
    const message = error instanceof Error ? error.message : String(error)
    if (message === SESSION_LOAD_CANCELLED) throw new HistoryBodyFailure('cancelled', message)
    if (message === 'Mismatched history reply') throw new HistoryBodyFailure('invalid', message)
    throw new HistoryBodyFailure('transport', message)
  }
  checkCurrent('Stale history body')
  if (reply.sessionId !== ref.session || reply.openGeneration !== openGeneration)
    throw new HistoryBodyFailure('invalid', 'Mismatched history reply')
  if (reply.status !== 'body') {
    const status = reply.status === 'missing' ? 'stale' : reply.status
    const reason =
      status === 'stale' || status === 'unavailable' || status === 'cancelled' ? status : 'invalid'
    throw new HistoryBodyFailure(reason, 'History body: ' + reply.status)
  }
  if (!reply.generation || !Number.isSafeInteger(reply.bytes) || reply.bytes <= 0)
    throw new HistoryBodyFailure('invalid', 'Invalid history body range')
  return reply
}

let bodySequence = 0

export async function readDeferredParts(
  ref: HistoryBodyRef,
  openGeneration: number,
  page: (query: HistoryQuery) => Promise<HistoryPageReply>,
  current: () => boolean,
  signal?: AbortSignal
): Promise<AppMessagePart[]> {
  let servedRef = ref
  const checkCurrent = (message: string): void => {
    if (signal?.aborted || !current()) throw new HistoryBodyFailure('cancelled', message)
  }
  for (let attempt = 0; ; attempt++) {
    const sequence = ++bodySequence
    let offset = 0
    let started = false
    let completed = false
    let job: ComputeHandle<ComputeResults['historyBody']> | undefined
    const cancel = (): void => job?.cancel()
    const request = (
      packet: HistoryBodyRequest['packet']
    ): ComputeHandle<ComputeResults['historyBody']> =>
      computeClient().request<'historyBody'>(
        { kind: 'historyBody', sequence, bytes: servedRef.bytes, packet },
        { cacheable: false }
      )
    signal?.addEventListener('abort', cancel, { once: true })
    try {
      while (true) {
        checkCurrent('Stale history body')
        const reply = await readBodyChunk(page, servedRef, openGeneration, offset, checkCurrent)
        if (started && servedRef.generation !== reply.generation) {
          servedRef = { ...ref, generation: reply.generation, bytes: reply.bytes }
          break
        }
        if (reply.offset !== offset) throw new HistoryBodyFailure('invalid', 'Stale history body')
        const bytes = reply.nextOffset - offset
        const padding = reply.base64.endsWith('==') ? 2 : reply.base64.endsWith('=') ? 1 : 0
        if (
          (started && servedRef.bytes !== reply.bytes) ||
          bytes <= 0 ||
          bytes > HISTORY_BODY_BYTES ||
          reply.base64.length !== 4 * Math.ceil(bytes / 3) ||
          (reply.base64.length * 3) / 4 - padding !== bytes ||
          reply.nextOffset > reply.bytes ||
          reply.done !== (reply.nextOffset === reply.bytes)
        )
          throw new HistoryBodyFailure('invalid', 'Invalid history body range')
        if (!started) servedRef = { ...ref, generation: reply.generation, bytes: reply.bytes }
        started = true
        let result: ComputeResults['historyBody']
        const epoch = computeClient().recoveryEpoch('compute')
        try {
          job = request({ offset, base64: reply.base64 })
          result = await job.promise
        } catch (error) {
          checkCurrent('Incomplete history body')
          // Failed decoding deletes its stream; replacing the worker drops it too.
          started = false
          const message = error instanceof Error ? error.message : String(error)
          if (message === 'worker-replaced') break
          throw new HistoryBodyFailure(
            'worker',
            message,
            isComputeWorkerFailure(error) ? epoch : undefined
          )
        } finally {
          job = undefined
        }
        if (result.nextOffset !== reply.nextOffset)
          throw new HistoryBodyFailure('invalid', 'Invalid history body acknowledgement')
        offset = result.nextOffset
        if (!reply.done) continue
        checkCurrent('Incomplete history body')
        completed = true
        for (const { index, segments } of result.layouts ?? []) {
          const part = result.parts[index]
          if (part?.type === 'text' || part?.type === 'reasoning')
            rememberHistoryLayout(part, part.text, segments)
        }
        return result.parts
      }
    } finally {
      signal?.removeEventListener('abort', cancel)
      if (started && !completed) {
        void request(null).promise.catch((error: unknown) => {
          rendererLog.warn('history.body.release-failed', 'chat', { error: String(error) })
        })
      }
    }
    if (attempt === 2) throw new HistoryBodyFailure('churn', 'History body changed three times')
  }
}
