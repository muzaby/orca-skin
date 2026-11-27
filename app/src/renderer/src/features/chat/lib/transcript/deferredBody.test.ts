import {
  computeClient,
  createComputeClient,
  setComputeClient,
  type WorkerLike
} from '../../../../shared/compute/client'
import { createHistoryBodyDecoder } from '../../../../shared/compute/worker/historyBody'
import { handleMessage } from '../../../../shared/compute/worker/handler'
import { installHistoryWorker } from '../../../../shared/compute/historyWorker.testfixture'
import { describe, it, expect, vi } from 'vitest'
import { readDeferredParts } from './deferredBody'
import {
  HISTORY_BODY_BYTES,
  type HistoryBodyRef,
  type HistoryPageReply,
  type HistoryQuery
} from '../../../../../../shared/history-page'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import { newTranscriptChanges } from './changeLog'

installHistoryWorker()

const ref: HistoryBodyRef = {
  kind: 'parts',
  session: 's',
  generation: 'g',
  message: 'middle',
  bytes: 1
}
describe('deferred history bodies', () => {
  it('decodes 4 MiB of Korean text including codepoints split at the 64 KiB boundary', async () => {
    const parts = [{ type: 'text', text: '가'.repeat(1_400_000) }]
    const bytes = Buffer.from(JSON.stringify(parts))
    const body = { ...ref, bytes: bytes.length }
    const offsets: number[] = []
    const page = async (q: HistoryQuery): Promise<HistoryPageReply> => {
      if (q.kind !== 'body') throw Error(q.kind)
      offsets.push(q.offset)
      const block = bytes.subarray(q.offset, q.offset + HISTORY_BODY_BYTES)
      const nextOffset = q.offset + block.length
      return {
        status: 'body',
        generation: ref.generation,
        bytes: bytes.length,
        sessionId: 's',
        openGeneration: 3,
        requestId: offsets.length,
        offset: q.offset,
        nextOffset,
        done: nextOffset === bytes.length,
        base64: block.toString('base64')
      }
    }
    expect(await readDeferredParts(body, 3, page, () => true)).toEqual(parts)
    expect(offsets).toEqual(
      Array.from(
        { length: Math.ceil(bytes.length / HISTORY_BODY_BYTES) },
        (_, i) => i * HISTORY_BODY_BYTES
      )
    )
    await expect(
      readDeferredParts(
        body,
        3,
        async (q) => ({ ...(await page(q)), sessionId: 't' }),
        () => true
      )
    ).rejects.toThrow()
    await expect(readDeferredParts(body, 4, page, () => true)).rejects.toThrow()
    let active = true
    await expect(
      readDeferredParts(
        body,
        3,
        async (q) => {
          active = false
          return page(q)
        },
        () => active
      )
    ).rejects.toThrow()
  })
  it.each([
    'wrong offset',
    'empty',
    'oversized',
    'wrong advance',
    'invalid part',
    'cancelled after reply',
    'cancelled before publish'
  ] as const)('rejects a deferred body with %s', async (problem) => {
    const sent = vi.spyOn(computeClient(), 'request')
    let text = problem === 'invalid part' ? '[{}]' : '[]'
    if (problem === 'oversized') text = text.padEnd(HISTORY_BODY_BYTES + 1)
    const body = { ...ref, bytes: text.length }
    const page = vi.fn<Parameters<typeof readDeferredParts>[2]>()
    page.mockResolvedValueOnce({
      status: 'body',
      generation: ref.generation,
      bytes: text.length,
      sessionId: 's',
      requestId: 1,
      openGeneration: 3,
      offset: problem === 'wrong offset' ? 1 : 0,
      nextOffset: problem === 'empty' ? 0 : problem === 'wrong advance' ? 1 : text.length,
      done: problem !== 'empty' && problem !== 'wrong advance',
      base64: Buffer.from(problem === 'empty' ? '' : text).toString('base64')
    })
    // A missing progress check must not turn a zero-length chunk into a test timeout.
    page.mockRejectedValue(Error('unexpected second read'))
    const current = vi.fn(() => true)
    if (problem === 'cancelled after reply')
      current.mockReturnValueOnce(true).mockReturnValue(false)
    if (problem === 'cancelled before publish')
      current.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false)
    const error =
      problem === 'cancelled before publish'
        ? 'Incomplete history body'
        : problem === 'wrong offset' || problem === 'cancelled after reply'
          ? 'Stale history body'
          : problem === 'invalid part'
            ? 'Invalid history body'
            : 'Invalid history body range'
    await expect(readDeferredParts(body, 3, page, current)).rejects.toThrow(error)
    expect(page).toHaveBeenCalledTimes(1)
    if (problem === 'oversized') expect(sent).not.toHaveBeenCalled()
  })
  it.each(['code', 'work', 'opencode'] as const)(
    'shows one stable message placeholder between its original neighbours in %s',
    (mode) => {
      const messages = ['first', 'middle', 'last'].map((id) => ({
        id,
        role: 'assistant' as const,
        createdAt: 1,
        parts: id === 'middle' ? [] : [{ type: 'text' as const, text: id }],
        ...(id === 'middle' ? { deferredBody: ref } : {})
      }))
      const input = { messages, transcriptChanges: newTranscriptChanges() }
      const snapshot =
        mode === 'opencode'
          ? createOpenCodeBlockModel().advance(input, {})
          : createClaudeBlockModel({ mode, sessionKey: 's' }).advance(input, {})
      const rows = Array.from({ length: snapshot.count }, (_, i) => snapshot.blockAt(i)).filter(
        (block) => block.kind === 'segment' || block.kind === 'deferred'
      )
      expect(rows.map((b) => [b.kind, b.messageId])).toEqual([
        ['segment', 'first'],
        ['deferred', 'middle'],
        ['segment', 'last']
      ])
    }
  )
})

it('waits for the worker to accept the current bytes before requesting the next SQLite page', async () => {
  const replies: (() => Promise<void>)[] = []
  setComputeClient(
    createComputeClient({
      createWorker: () => {
        const port: WorkerLike = {
          onmessage: null,
          onerror: null,
          onmessageerror: null,
          terminate: vi.fn(),
          postMessage(message) {
            if (!('type' in message))
              replies.push(async () => {
                const data = await handleMessage(message)
                port.onmessage?.({ data })
              })
          }
        }
        return port
      }
    })
  )
  const parts = [{ type: 'text', text: 'abc' }]
  const bytes = Buffer.from(JSON.stringify(parts).padEnd(HISTORY_BODY_BYTES + 2))
  const offsets: number[] = []
  const reading = readDeferredParts(
    { ...ref, bytes: bytes.length },
    3,
    async (query) => {
      if (query.kind !== 'body') throw Error(query.kind)
      offsets.push(query.offset)
      const packet = bytes.subarray(query.offset, query.offset + HISTORY_BODY_BYTES)
      const nextOffset = query.offset + packet.length
      return {
        status: 'body',
        generation: ref.generation,
        bytes: bytes.length,
        sessionId: 's',
        openGeneration: 3,
        requestId: 1,
        offset: query.offset,
        nextOffset,
        done: nextOffset === bytes.length,
        base64: packet.toString('base64')
      }
    },
    () => true
  )
  await vi.waitFor(() => expect(replies).toHaveLength(1))
  expect(offsets).toEqual([0])
  await replies.shift()!()
  await vi.waitFor(() => expect(replies).toHaveLength(1))
  expect(offsets).toEqual([0, HISTORY_BODY_BYTES])
  await replies.shift()!()
  await expect(reading).resolves.toEqual(parts)
})

it.each([
  ['generation', 'worker', 'success'],
  ['worker', 'generation', 'worker'],
  ['worker', 'worker', 'worker']
] as const)('AC3″ shares the two restarts across %s, %s and %s', async (...events) => {
  const parts = [{ type: 'text', text: 'chunked' }]
  const bytes = Buffer.from(JSON.stringify(parts).padEnd(HISTORY_BODY_BYTES + 1))
  const offsets: number[] = []
  let generation = 0
  let attempts = 0
  const released: number[] = []
  const started: number[] = []
  setComputeClient(
    createComputeClient({
      createWorker() {
        const port: WorkerLike = {
          onmessage: null,
          onerror: null,
          onmessageerror: null,
          terminate: vi.fn(),
          postMessage(message) {
            if ('type' in message || message.kind !== 'historyBody') return
            if (!message.packet) released.push(message.sequence)
            if (message.packet?.offset === 0) started.push(message.sequence)
            if (message.packet?.offset && events[attempts - 1] === 'worker') {
              // A new worker receives the continuation without the old stream.
              const fresh = createHistoryBodyDecoder()
              try {
                fresh(message)
              } catch (error) {
                queueMicrotask(() =>
                  port.onmessage?.({
                    data: { id: message.id, ok: false, error: (error as Error).message }
                  })
                )
              }
            } else {
              void handleMessage(message).then((data) => port.onmessage?.({ data }))
            }
          }
        }
        return port
      }
    })
  )
  const reading = readDeferredParts(
    { ...ref, bytes: bytes.length },
    3,
    async (q) => {
      if (q.kind !== 'body') throw Error(q.kind)
      offsets.push(q.offset)
      if (q.offset === 0) attempts++
      else if (events[attempts - 1] === 'generation') generation++
      const packet = bytes.subarray(q.offset, q.offset + HISTORY_BODY_BYTES)
      return {
        status: 'body',
        sessionId: 's',
        requestId: 1,
        openGeneration: 3,
        generation: 'p' + generation,
        bytes: bytes.length,
        offset: q.offset,
        nextOffset: q.offset + packet.length,
        done: q.offset + packet.length === bytes.length,
        base64: packet.toString('base64')
      }
    },
    () => true
  )
  if (events[2] === 'success') await expect(reading).resolves.toEqual(parts)
  else await expect(reading).rejects.toMatchObject({ reason: 'churn' })
  expect(offsets).toEqual([0, HISTORY_BODY_BYTES, 0, HISTORY_BODY_BYTES, 0, HISTORY_BODY_BYTES])
  expect(new Set(started).size).toBe(3)
  expect(released).toEqual(started.filter((_sequence, index) => events[index] === 'generation'))
})
