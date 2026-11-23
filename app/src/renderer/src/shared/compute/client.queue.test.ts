import { expect, it, vi } from 'vitest'
import {
  ComputeCancelled,
  createComputeClient,
  type ComputeClient,
  type ComputeJobTiming,
  type DocumentLease,
  type WorkerLike
} from './client'
import { createWorkerState } from './worker/state'
import type { TokensRequest, WireRequest, WireControl } from './protocol'
const range = {
  kind: 'tokens',
  doc: { id: 'a', revision: 1 },
  lang: 'typescript',
  theme: 'github-light',
  start: 0,
  end: 101
} satisfies TokensRequest
function setup(
  count = 101,
  timing?: { now(): number; timings?(entry: ComputeJobTiming): void }
): {
  client: ComputeClient
  lease: DocumentLease
  messages: (WireRequest | WireControl)[]
  advance(): Promise<void>
} {
  const messages: (WireRequest | WireControl)[] = []
  let tick = 0
  const receive = createWorkerState(() => tick++)
  const port: WorkerLike = {
    onerror: null,
    onmessageerror: null,
    onmessage: null,
    terminate: vi.fn(),
    postMessage(message) {
      messages.push(message)
    }
  }
  const client = createComputeClient({ createWorker: () => port, ...timing })
  const lease = client.openDocument(
    range.doc,
    { text: Array(count).fill('let a=1').join('\n') },
    'compute'
  )
  let index = 0
  async function advance(): Promise<void> {
    while (index < messages.length) {
      const message = messages[index++]
      const response = await receive(message)
      if (response) {
        port.onmessage?.({ data: response })
        return
      }
    }
    throw Error('no pending response')
  }
  return { client, lease, messages, advance }
}
it('q4 dispatches fresh visible work before a yielded range and resumes with a new id', async () => {
  const { client, lease, messages, advance } = setup()
  const pending = client.request(range)
  const highlight = client.request({
    kind: 'highlight',
    lang: range.lang,
    theme: range.theme,
    code: 'const example = 1'.repeat(20)
  })
  const next = client.request({ ...range, start: 100, end: 101 })
  for (let i = 0; i < 8; i++) {
    await advance()
    if (client.peek(range)) break
  }
  expect((await pending.promise).rows).toHaveLength(101)
  expect((await next.promise).rows).toHaveLength(1)
  expect((await highlight.promise).html).toContain('shiki')
  const sent = messages.filter((message) => 'id' in message)
  expect(sent.slice(0, 3).map((message) => [message.kind, message.resumeFrom])).toEqual([
    ['tokens', undefined],
    ['tokens', undefined],
    ['highlight', undefined]
  ])
  expect(new Set(sent.map((message) => message.id)).size).toBe(sent.length)
  lease.release()
})
it('q10 drops a cancelled token job when it yields', async () => {
  const { client, lease, messages, advance } = setup()
  const job = client.request(range)
  job.cancel()
  await expect(job.promise).rejects.toBeInstanceOf(ComputeCancelled)
  await advance()
  expect(messages).toHaveLength(2)
  expect(client.peek(range)).toBeUndefined()
  lease.release()
})
it.each([
  [-1, 10, 'range-invalid'],
  [10, 5, 'range-invalid'],
  [1.5, 3, 'range-invalid'],
  [0, 201, 'range-too-large']
] as const)('q8 rejects [%i,%i) before transmission', async (start, end, error) => {
  const { client, messages, lease } = setup()
  await expect(client.request({ ...range, start, end }).promise).rejects.toThrow(error)
  expect(messages).toHaveLength(0)
  lease.release()
})

it.each(['highlight', 'tokens'] as const)(
  'q4 serves a new %s at the next yield of a 50,000-line seek',
  async (kind) => {
    const { client, lease, advance, messages } = setup(50000)
    const distant = client.request({ ...range, start: 49800, end: 50000 })
    const fresh =
      kind === 'tokens'
        ? client.request({ ...range, start: 0, end: 1 })
        : client.request({
            kind: 'highlight',
            lang: range.lang,
            theme: range.theme,
            code: 'const x = 1;'.repeat(100)
          })
    await advance()
    const dispatched = messages.at(-1)
    expect(dispatched).toMatchObject({ kind })
    if (kind === 'tokens') expect(dispatched).toHaveProperty('start', 0)
    distant.cancel()
    await expect(distant.promise).rejects.toBeInstanceOf(ComputeCancelled)
    await advance()
    await fresh.promise
    lease.release()
  }
)

it.each(['promote', 'demote', 'cancel'] as const)(
  'q9 reorders a shared queued request when its highest priority changes: %s',
  async (mode) => {
    const { client, advance, messages, lease } = setup()
    const first = client.request({ ...range, end: 1 })
    const short = client.request({ ...range, end: 2 }, { priority: 'background' })
    const large = client.request({ ...range, end: 3 }, { priority: 'background' })
    const shared = client.request(
      { ...range, end: 3 },
      { priority: mode === 'promote' ? 'background' : 'visible' }
    )
    if (mode === 'cancel') {
      shared.cancel()
      await expect(shared.promise).rejects.toBeInstanceOf(ComputeCancelled)
    } else shared.setPriority(mode === 'promote' ? 'visible' : 'background')
    await advance()
    expect(messages.at(-1)).toMatchObject({ kind: 'tokens', end: mode === 'promote' ? 3 : 2 })
    await advance()
    await advance()
    await Promise.all([first.promise, short.promise, large.promise])
    lease.release()
  }
)

it('q12 records waiting time separately from each token slice and preserves queue time on promotion', async () => {
  let time = 0
  const entries: ComputeJobTiming[] = []
  const { client, lease, advance } = setup(101, {
    now: () => time,
    timings: (entry) => entries.push(entry)
  })
  const pending = client.request(range)
  time = 10
  const next = client.request({ ...range, end: 1 }, { priority: 'background' })
  time = 20
  next.setPriority('visible')
  time = 50
  await advance()
  time = 57
  await advance()
  expect(entries[0]).toMatchObject({
    kind: 'tokens',
    lane: 'compute',
    yields: 0,
    enqueuedAt: 0,
    startedAt: 0,
    endedAt: 50
  })
  expect(entries[1]).toMatchObject({
    priority: 'visible',
    yields: 0,
    enqueuedAt: 10,
    startedAt: 50,
    endedAt: 57
  })
  time = 107
  await advance()
  time = 108
  await advance()
  expect(entries.slice(2).map((e) => [e.yields, e.enqueuedAt, e.startedAt, e.endedAt])).toEqual([
    [1, 50, 57, 107],
    [2, 107, 107, 108]
  ])
  await Promise.all([pending.promise, next.promise])
  lease.release()
})
it('q13 skips timing clock reads without a sink', async () => {
  const now = vi.fn(() => 0)
  const { client, lease, advance } = setup(101, { now })
  const result = client.request({ ...range, end: 1 })
  await advance()
  await result.promise
  expect(now).not.toHaveBeenCalled()
  lease.release()
})
