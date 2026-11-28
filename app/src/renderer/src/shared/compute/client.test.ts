// 계산 클라이언트의 대기열·캐시·취소·실패 (0324 AC11~AC14 · MD-01 · SD-01).
// 가짜 워커를 주입한다 — 무엇이 워커에 나갔고 언제 끝났는지를 기록으로 본다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ComputeCancelled,
  isComputeWorkerFailure,
  createComputeClient,
  type ComputeClient,
  type WorkerLike
} from './client'
import { rendererLog } from '../logging'
import * as protocol from './protocol'
import { requestKey, resultSize, type ComputeResult, type WireRequest } from './protocol'
import { handleMessage } from './worker/handler'

afterEach(() => vi.restoreAllMocks())

class FakeWorker implements WorkerLike {
  posted: WireRequest[] = []
  terminated = 0
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onmessageerror: ((event: unknown) => void) | null = null

  postMessage(message: WireRequest): void {
    this.posted.push(message)
  }
  terminate(): void {
    this.terminated += 1
  }
  // 마지막으로 받은 요청에 답한다. 워커처럼 결과 크기(`size`)를 싣는다(0325 D-011).
  reply(
    result: ComputeResult,
    at = this.posted.length - 1,
    size: unknown = resultSize(result)
  ): void {
    this.onmessage?.({ data: { id: this.posted[at].id, ok: true, result, size } })
  }
}

interface Harness {
  client: ComputeClient
  workers: FakeWorker[]
  errors: unknown[]
  last(): FakeWorker
}

function harness(
  options: { cacheMaxChars?: number; cacheMaxEntries?: number; failCreate?: () => boolean } = {}
): Harness {
  const workers: FakeWorker[] = []
  const errors: unknown[] = []
  const client = createComputeClient({
    createWorker: () => {
      if (options.failCreate?.()) throw new Error('create failed')
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    },
    onError: (error) => errors.push(error),
    cacheMaxChars: options.cacheMaxChars,
    cacheMaxEntries: options.cacheMaxEntries
  })
  return { client, workers, errors, last: () => workers[workers.length - 1] }
}

const hl = (code: string, theme: 'github-light' | 'github-dark' = 'github-light', lang = 'ts') =>
  ({ kind: 'highlight', code, lang, theme }) as const
const html = (text: string): { html: string } => ({ html: text })
const codeOf = (message: WireRequest): string => (message.kind === 'highlight' ? message.code : '')

// 결과를 기다리지 않고 상태만 본다 — 취소·실패의 거절이 미처리로 새지 않게 잡아 둔다.
interface Tracked<R> {
  state: { value?: R; error?: unknown; settled: boolean }
  cancel(): void
}

function track<R>(handle: { promise: Promise<R>; cancel(): void }): Tracked<R> {
  const state: { value?: R; error?: unknown; settled: boolean } = { settled: false }
  handle.promise.then(
    (value) => Object.assign(state, { value, settled: true }),
    (error: unknown) => Object.assign(state, { error, settled: true })
  )
  return { state, cancel: () => handle.cancel() }
}
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}

describe('전송과 응답', () => {
  it('첫 요청에 워커를 만들고 요청을 보낸다. 응답이 오면 그 결과로 끝난다', async () => {
    const h = harness()
    expect(h.workers).toHaveLength(0)
    const a = track(h.client.request(hl('a')))
    expect(h.workers).toHaveLength(1)
    expect(h.last().posted).toEqual([
      { kind: 'highlight', code: 'a', lang: 'ts', theme: 'github-light', id: 1 }
    ])
    h.last().reply(html('<a>'))
    await flush()
    expect(a.state.value).toEqual({ html: '<a>' })
  })

  it('워커에 나가 있는 요청은 1개다 — 다음 요청은 응답 뒤에 나간다', async () => {
    const h = harness()
    track(h.client.request(hl('a')))
    track(h.client.request(hl('b')))
    expect(h.last().posted.map(codeOf)).toEqual(['a'])
    h.last().reply(html('<a>'))
    expect(h.last().posted.map(codeOf)).toEqual(['a', 'b'])
    expect(h.workers).toHaveLength(1)
  })

  it('다른 요청 번호의 응답과 형식이 아닌 메시지는 버린다', async () => {
    const h = harness()
    const a = track(h.client.request(hl('a')))
    h.last().onmessage?.({ data: { id: 999, ok: true, result: html('x') } })
    h.last().onmessage?.({ data: 'garbage' })
    await flush()
    expect(a.state.settled).toBe(false)
  })

  it('요청 하나의 계산 오류는 그 요청만 실패시키고 워커는 그대로 쓴다', async () => {
    const h = harness()
    const a = track(h.client.request(hl('a')))
    const b = track(h.client.request(hl('b')))
    h.last().onmessage?.({ data: { id: h.last().posted[0].id, ok: false, error: 'bad lang' } })
    await flush()
    expect((a.state.error as Error).message).toBe('bad lang')
    expect(h.errors).toEqual([])
    expect(h.last().terminated).toBe(0)
    h.last().reply(html('<b>'))
    await flush()
    expect(b.state.value).toEqual({ html: '<b>' })
  })
})

describe('순서 (AC13)', () => {
  it('대기 요청은 입력 길이가 짧은 것부터 나간다', () => {
    const h = harness()
    track(h.client.request(hl('first')))
    for (const length of [9000, 10, 500]) track(h.client.request(hl('x'.repeat(length))))
    const sent = (): number[] => h.last().posted.map((m) => codeOf(m).length)
    for (let i = 0; i < 3; i++) h.last().reply(html('r'))
    expect(sent()).toEqual([5, 10, 500, 9000])
  })

  it('길이가 같으면 먼저 온 것이 먼저 나간다', () => {
    const h = harness()
    track(h.client.request(hl('first')))
    for (const code of ['bb', 'aa', 'cc']) track(h.client.request(hl(code)))
    for (let i = 0; i < 3; i++) h.last().reply(html('r'))
    expect(h.last().posted.map(codeOf)).toEqual(['first', 'bb', 'aa', 'cc'])
  })
})

describe('캐시 (AC14)', () => {
  it('같은 (종류, 내용, 언어, 테마) 재요청은 워커에 가지 않는다', async () => {
    const h = harness()
    track(h.client.request(hl('a')))
    h.last().reply(html('<a>'))
    const again = track(h.client.request(hl('a')))
    await flush()
    expect(again.state.value).toEqual({ html: '<a>' })
    expect(h.last().posted).toHaveLength(1)
    expect(h.client.peek(hl('a'))).toEqual({ html: '<a>' })
    expect(h.client.peek(hl('never'))).toBeUndefined()
  })

  it.each([
    ['테마', hl('a', 'github-dark')],
    ['언어', hl('a', 'github-light', 'js')],
    ['내용', hl('b')]
  ])('%s만 다른 요청은 전송된다', (_label, other) => {
    const h = harness()
    track(h.client.request(hl('a')))
    h.last().reply(html('<a>'))
    track(h.client.request(other))
    expect(h.last().posted).toHaveLength(2)
  })

  it('종류가 다르면 내용이 같아도 전송된다', () => {
    const h = harness()
    track(h.client.request({ kind: 'diffLines', oldValue: 'a', newValue: 'b' }))
    h.last().reply({ lines: [] })
    track(
      h.client.request({
        kind: 'diffTokens',
        oldText: 'a',
        newText: 'b',
        lang: 'ts',
        theme: 'github-light'
      })
    )
    expect(h.last().posted).toHaveLength(2)
  })

  // 항목 비용 = 키 길이 + 결과 크기(0325 D-038) — 상한은 항목 둘이 꼭 드는 값이다.
  const twoEntries = 2 * (requestKey(hl('a')).length + 4)

  it('결과 문자 수 합이 상한을 넘으면 가장 오래 안 쓴 것부터 버린다', () => {
    const h = harness({ cacheMaxChars: twoEntries })
    const fill = (code: string, size: number): void => {
      track(h.client.request(hl(code)))
      h.last().reply(html('x'.repeat(size)))
    }
    fill('a', 4)
    fill('b', 4)
    // a 를 다시 읽어 최근 사용으로 올린다 — 이제 가장 오래 안 쓴 것은 b 다.
    track(h.client.request(hl('a')))
    fill('c', 4)
    expect(h.last().posted.map(codeOf)).toEqual(['a', 'b', 'c'])
    track(h.client.request(hl('a')))
    track(h.client.request(hl('c')))
    expect(h.last().posted).toHaveLength(3)
    track(h.client.request(hl('b')))
    expect(h.last().posted.map(codeOf)).toEqual(['a', 'b', 'c', 'b'])
  })

  it('상한 이하면 버리지 않는다', () => {
    const h = harness({ cacheMaxChars: twoEntries })
    for (const code of ['a', 'b']) {
      track(h.client.request(hl(code)))
      h.last().reply(html('xxxx'))
    }
    track(h.client.request(hl('a')))
    track(h.client.request(hl('b')))
    expect(h.last().posted).toHaveLength(2)
  })
})

describe('중복 공유', () => {
  it('같은 키의 요청이 실행 중이면 한 계산을 공유한다', async () => {
    const h = harness()
    const a1 = track(h.client.request(hl('a')))
    const a2 = track(h.client.request(hl('a')))
    expect(h.last().posted).toHaveLength(1)
    h.last().reply(html('<a>'))
    await flush()
    expect([a1.state.value, a2.state.value]).toEqual([{ html: '<a>' }, { html: '<a>' }])
  })

  it('공유자 하나만 취소하면 계산은 계속되고 남은 공유자가 결과를 받는다', async () => {
    const h = harness()
    track(h.client.request(hl('run')))
    const q1 = track(h.client.request(hl('queued')))
    const q2 = track(h.client.request(hl('queued')))
    q1.cancel()
    h.last().reply(html('<run>'))
    expect(h.last().posted.map(codeOf)).toEqual(['run', 'queued'])
    h.last().reply(html('<q>'))
    await flush()
    expect(q1.state.error).toBeInstanceOf(ComputeCancelled)
    expect(q2.state.value).toEqual({ html: '<q>' })
  })
})

describe('취소 (AC11)', () => {
  it('대기 중 취소된 요청은 워커에 보내지 않는다', async () => {
    const h = harness()
    track(h.client.request(hl('run')))
    const queued = track(h.client.request(hl('queued')))
    queued.cancel()
    h.last().reply(html('<run>'))
    await flush()
    expect(h.last().posted.map(codeOf)).toEqual(['run'])
    expect(queued.state.error).toBeInstanceOf(ComputeCancelled)
  })

  it('실행 중 highlight 취소는 문서와 워커를 보존하고 다음 작업을 이어 간다', async () => {
    const h = harness()
    const run = track(h.client.request(hl('run')))
    const queued = track(h.client.request(hl('queued')))
    run.cancel()
    expect(h.workers).toHaveLength(1)
    h.last().reply(html('<late>'))
    expect(h.last().posted.map(codeOf)).toEqual(['run', 'queued'])
    h.last().reply(html('<q>'))
    await flush()
    expect(run.state.error).toBeInstanceOf(ComputeCancelled)
    expect(queued.state.value).toEqual({ html: '<q>' })
  })

  it('실행 중 요청이 취소돼도 대기 요청이 없으면 워커를 두고, 늦은 응답은 캐시에만 들어간다', async () => {
    const h = harness()
    const run = track(h.client.request(hl('run')))
    run.cancel()
    expect(h.last().terminated).toBe(0)
    h.last().reply(html('<run>'))
    await flush()
    expect(run.state.value).toBeUndefined()
    expect(run.state.error).toBeInstanceOf(ComputeCancelled)
    expect(h.client.peek(hl('run'))).toEqual({ html: '<run>' })
    expect(h.workers).toHaveLength(1)
  })

  it('취소를 두 번 불러도 한 번만 처리한다', () => {
    const h = harness()
    const run = track(h.client.request(hl('run')))
    track(h.client.request(hl('queued')))
    run.cancel()
    run.cancel()
    expect(h.workers).toHaveLength(1)
  })
})

describe('실패 (AC12)', () => {
  it.each(['onerror', 'onmessageerror'] as const)(
    '%s — 실행 중 요청을 실패시키고 오류 1건을 남기고 워커를 버린다',
    async (event) => {
      const h = harness()
      const a = track(h.client.request(hl('a')))
      const first = h.last()
      first[event]?.('boom')
      await flush()
      expect((a.state.error as Error).message).toBe('compute worker failed')
      expect(h.errors).toEqual(['boom'])
      expect(first.terminated).toBe(1)
    }
  )

  it('실패 뒤 대기 요청은 새 워커로 이어 간다', async () => {
    const h = harness()
    track(h.client.request(hl('a')))
    const b = track(h.client.request(hl('b')))
    h.last().onerror?.('boom')
    expect(h.workers).toHaveLength(2)
    expect(h.last().posted.map(codeOf)).toEqual(['b'])
    h.last().reply(html('<b>'))
    await flush()
    expect(b.state.value).toEqual({ html: '<b>' })
  })

  it('워커 생성 실패 — 요청은 실패로 끝나고 오류 1건이 남는다', async () => {
    const h = harness({ failCreate: () => true })
    const a = track(h.client.request(hl('a')))
    await flush()
    expect((a.state.error as Error).message).toBe('compute worker failed')
    expect(h.errors).toHaveLength(1)
  })

  it('연속 3회 실패 뒤의 4번째 요청은 워커를 만들지 않고 즉시 실패한다', async () => {
    let creates = 0
    const h = harness({
      failCreate: () => {
        creates += 1
        return true
      }
    })
    for (const code of ['a', 'b', 'c']) track(h.client.request(hl(code)))
    expect(creates).toBe(3)
    expect(h.errors).toHaveLength(3)
    const fourth = track(h.client.request(hl('d')))
    await flush()
    expect(creates).toBe(3)
    expect(h.errors).toHaveLength(3)
    expect((fourth.state.error as Error).message).toBe('compute worker failed')
  })

  it('한도에 닿으면 대기열에 남은 요청도 실패한다', async () => {
    const h = harness()
    const run = track(h.client.request(hl('a')))
    const rest = ['bb', 'ccc', 'dddd'].map((code) => track(h.client.request(hl(code))))
    for (let i = 0; i < 3; i++) h.last().onerror?.(`boom${i}`)
    await flush()
    expect(h.workers).toHaveLength(3)
    expect([run, ...rest].map((r) => (r.state.error as Error)?.message)).toEqual(
      Array(4).fill('compute worker failed')
    )
  })

  it('성공 응답이 오면 연속 실패 횟수는 0 이 된다', async () => {
    const h = harness()
    const fail = (code: string): void => {
      track(h.client.request(hl(code)))
      h.last().onerror?.('boom')
    }
    fail('a')
    fail('b')
    track(h.client.request(hl('ok')))
    h.last().reply(html('<ok>'))
    fail('c')
    fail('d')
    // 성공이 끼어 연속 2회다 — 아직 워커를 만든다.
    const next = track(h.client.request(hl('e')))
    h.last().reply(html('<e>'))
    await flush()
    expect(next.state.value).toEqual({ html: '<e>' })
    expect(h.errors).toHaveLength(4)
  })

  it('버린 워커의 늦은 오류 이벤트는 세지 않는다', () => {
    const h = harness()
    track(h.client.request(hl('a')))
    const first = h.last()
    const lateError = first.onerror
    lateError?.('boom')
    expect(first.onerror).toBeNull()
    expect(h.errors).toHaveLength(1)
  })
})

// ── 0325 VP-19 · VP-20 · EP-5 — 워커가 센 크기 + 키 길이로만 캐시 ─────────────────────
describe('캐시 비용 (0325)', () => {
  const cost = (request: Parameters<typeof requestKey>[0], size: number): number =>
    requestKey(request).length + size

  it('k1 비용 ≤ 상한 → 캐시 · LRU 그대로', async () => {
    const h = harness({ cacheMaxChars: cost(hl('a'), 4) })
    const a = track(h.client.request(hl('a')))
    h.last().reply(html('xxxx'))
    await flush()
    expect(a.state.value).toEqual({ html: 'xxxx' })
    expect(h.client.peek(hl('a'))).toEqual({ html: 'xxxx' })
  })

  it('k2 비용 > 상한 → 요청자 resolve · 미보관 · 기존 항목 유지', async () => {
    const h = harness({ cacheMaxChars: cost(hl('a'), 4) + 10 })
    track(h.client.request(hl('a')))
    h.last().reply(html('xxxx'))
    const big = track(h.client.request(hl('b')))
    h.last().reply(html('y'.repeat(100)))
    await flush()
    expect(big.state.value).toEqual({ html: 'y'.repeat(100) })
    expect(h.client.peek(hl('b'))).toBeUndefined()
    expect(h.client.peek(hl('a'))).toEqual({ html: 'xxxx' })
  })

  it.each([
    ['없음', 'missing'],
    ['음수', -1],
    ['NaN', Number.NaN]
  ] as const)('k3 size %s → resolve · 미보관', async (_name, size) => {
    const h = harness()
    const a = track(h.client.request(hl('a')))
    const id = h.last().posted.at(-1)!.id
    h.last().onmessage?.({
      data:
        size === 'missing'
          ? { id, ok: true, result: html('<a>') }
          : { id, ok: true, result: html('<a>'), size }
    })
    await flush()
    expect(a.state.value).toEqual({ html: '<a>' })
    expect(h.client.peek(hl('a'))).toBeUndefined()
  })

  it('k4 실행 중 취소 뒤 늦은 응답 비용 > 상한 → 미보관', async () => {
    const h = harness({ cacheMaxChars: cost(hl('a'), 4) })
    const a = track(h.client.request(hl('a')))
    a.cancel()
    h.last().reply(html('z'.repeat(5)))
    await flush()
    expect(h.client.peek(hl('a'))).toBeUndefined()
  })

  it('k5 빈 줄만 내는 서로 다른 거대 diff 요청 40건(실제 `handleMessage`) → 보관 ≤ 1', async () => {
    const h = harness()
    const requests = Array.from({ length: 40 }, (_, index) => ({
      kind: 'diffLines' as const,
      oldValue: '\n'.repeat(100_000 + index),
      newValue: ''
    }))
    for (const request of requests) {
      track(h.client.request(request))
      const response = await handleMessage(h.last().posted.at(-1)!)
      h.last().onmessage?.({ data: response })
      await flush()
    }
    const kept = requests.filter((request) => h.client.peek(request) !== undefined)
    expect(kept.length).toBeLessThanOrEqual(1)
    const keptCost = kept.reduce(
      (sum, request) => sum + cost(request, 36 * request.oldValue.length),
      0
    )
    expect(keptCost).toBeLessThanOrEqual(4_000_000)
  })

  it('k6 서로 다른 작은 요청 1,001건 → 항목 1,000 · 가장 오래된 것부터 버린다', () => {
    const h = harness()
    for (let index = 0; index <= 1_000; index++) {
      track(h.client.request(hl(`c${index}`)))
      h.last().reply(html('x'))
    }
    expect(h.client.peek(hl('c0'))).toBeUndefined()
    expect(h.client.peek(hl('c1'))).toEqual({ html: 'x' })
    expect(h.client.peek(hl('c1000'))).toEqual({ html: 'x' })
  })

  it('k7 size 0 · 키 4,000,001자 → 미보관', async () => {
    const h = harness()
    const request = hl('k'.repeat(4_000_001))
    const handle = track(h.client.request(request))
    h.last().reply(html(''), undefined, 0)
    await flush()
    expect(handle.state.value).toEqual({ html: '' })
    expect(h.client.peek(request)).toBeUndefined()
  })

  it('caches by the size the worker computed, without measuring on the UI thread', async () => {
    const measure = vi.spyOn(protocol, 'resultSize')
    const request = { kind: 'diffLines' as const, oldValue: '\n'.repeat(1_000), newValue: '' }
    const expected = cost(request, 36_000)
    for (const [cap, kept] of [
      [expected, true],
      [expected - 1, false]
    ] as const) {
      measure.mockClear()
      const h = harness({ cacheMaxChars: cap })
      track(h.client.request(request))
      const response = await handleMessage(h.last().posted.at(-1)!)
      expect(response).toMatchObject({ ok: true, size: 36_000 })
      h.last().onmessage?.({ data: response })
      await flush()
      // 크기는 워커 처리기에서 한 번만 센다 — 클라이언트는 결과를 순회하지 않는다.
      expect(measure).toHaveBeenCalledTimes(1)
      expect(h.client.peek(request) !== undefined).toBe(kept)
    }
  })
})

it('AC14 historyBody round trip uses the worker result and rejects a cancelled generation', async () => {
  const { client, last } = harness()
  const bytes = Buffer.from(JSON.stringify([{ type: 'text', text: '본문' }]))
  const input = {
    kind: 'historyBody' as const,
    sequence: 1,
    packet: { offset: 0, base64: bytes.toString('base64') },
    bytes: bytes.length
  }
  const first = client.request(input, { cacheable: false })
  const ran = await handleMessage(last().posted[0])
  if (ran.ok !== true) throw Error('history worker failed')
  last().onmessage?.({ data: ran })
  await expect(first.promise).resolves.toEqual({
    parts: [{ type: 'text', text: '본문' }],
    nextOffset: bytes.length
  })
  const second = client.request({ ...input, sequence: 2 }, { cacheable: false })
  second.cancel()
  last().onmessage?.({ data: { ...ran, id: last().posted[1].id } })
  await expect(second.promise).rejects.toThrow('cancelled')
})

it('AC8 worker result for an oversized markdown block carries a size and formatted tree', async () => {
  const { markdownBlock } = await import('./worker/markdown')
  const { client, last } = harness()
  const text = '한'.repeat(50001) + ' **끝**'
  const doc = { id: 'oversize', revision: 1 }
  const lease = client.openDocument(doc, { text }, 'markdown')
  const request = { kind: 'markdown' as const, doc, start: 0, end: text.length }
  const job = client.request(request)
  const parsed = markdownBlock({ text }, request)
  expect(resultSize(parsed)).toBeGreaterThan(text.length)
  last().reply(parsed)
  await expect(job.promise).resolves.toMatchObject({
    hast: { children: [{ tagName: 'p', children: [{ type: 'text' }, { tagName: 'strong' }] }] }
  })
  lease.release()
})

describe('AC20 lane lifecycle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function crash(h: Harness, count = 1): void {
    for (let i = 0; i < count; i++) {
      track(h.client.request(hl('crashes'), { cacheable: false }))
      h.last().onerror!({ message: 'startup' })
    }
  }
  function succeed(h: Harness): void {
    track(h.client.request(hl('succeeds'), { cacheable: false }))
    h.last().reply(html('ok'))
  }
  function calculationError(h: Harness, reason: string): void {
    track(h.client.request(hl('bad input')))
    const id = h.last().posted.at(-1)!.id
    h.last().onmessage!({ data: { id, ok: false, error: reason } })
  }

  it.each([1, 2])('AC20 recreates below the limit (%i)', (count) => {
    const h = harness()
    crash(h, count)
    expect(h.client.workerEpoch('compute')).toBe(count)
    expect(h.client.workerEpoch('image')).toBe(0)
    succeed(h)
    expect(h.workers.length).toBe(count + 1)
    expect(h.client.recoveryEpoch('compute')).toBe(1)
  })

  it('AC20 waits 2s after the limit', async () => {
    const h = harness()
    crash(h, 3)
    vi.advanceTimersByTime(1_999)
    const denied = await h.client.request(hl('blocked')).promise.catch((error: unknown) => error)
    expect(isComputeWorkerFailure(denied)).toBe(true)
    expect(h.workers).toHaveLength(3)
    vi.advanceTimersByTime(1)
    expect(h.workers).toHaveLength(3)
    succeed(h)
    expect(h.workers).toHaveLength(4)
    expect(h.client.recoveryEpoch('compute')).toBe(1)
  })

  it('AC20 grows the wait to 10s and caps at 60s', async () => {
    const h = harness()
    for (const delay of [2_000, 10_000, 60_000, 60_000]) {
      crash(h, 3)
      const workers = h.workers.length
      vi.advanceTimersByTime(delay - 1)
      const denied = track(h.client.request(hl('blocked')))
      expect(h.workers).toHaveLength(workers)
      await flush()
      expect(isComputeWorkerFailure(denied.state.error)).toBe(true)
      vi.advanceTimersByTime(1)
      succeed(h)
      expect(h.workers).toHaveLength(workers + 1)
    }
    expect(h.client.recoveryEpoch('compute')).toBe(4)
  })

  it('AC20 announces recovery once and ignores stale worker replies', () => {
    const h = harness()
    const notify = vi.fn()
    const other = vi.fn()
    h.client.subscribeRecovery('compute', notify)
    h.client.subscribeRecovery('image', other)
    succeed(h)
    const old = h.last().onerror!
    expect(notify).not.toHaveBeenCalled()
    crash(h)
    succeed(h)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(other).not.toHaveBeenCalled()
    old('stale event')
    succeed(h)
    expect(h.client.recoveryEpoch('compute')).toBe(1)
    expect(h.client.workerEpoch('compute')).toBe(1)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('AC20 recovers after the cool-down and announces recovery to remaining consumers', () => {
    const h = harness()
    crash(h, 3)
    const left = vi.fn()
    const keep = vi.fn()
    h.client.subscribeRecovery('compute', left)()
    vi.advanceTimersByTime(2_000)
    expect(h.workers).toHaveLength(3)
    h.client.subscribeRecovery('compute', keep)
    vi.advanceTimersByTime(0)
    expect(h.workers).toHaveLength(4)
    const check = h.last().posted.at(-1)!
    expect(check).toMatchObject({ type: 'health' })
    expect(keep).not.toHaveBeenCalled()
    h.last().onmessage!({ data: { ok: 'ready', id: check.id + 1 } })
    expect(keep).not.toHaveBeenCalled()
    h.last().onmessage!({ data: { ok: 'ready', id: check.id } })
    h.last().onmessage!({ data: { ok: 'ready', id: check.id } })
    expect(keep).toHaveBeenCalledTimes(1)
    expect(left).not.toHaveBeenCalled()
    expect(h.client.recoveryEpoch('compute')).toBe(1)
  })

  it('AC20 reschedules the recovery check when the timer wakes before the cool-down ends', () => {
    let lag = 0
    const workers: FakeWorker[] = []
    const client = createComputeClient({
      createWorker: () => {
        const worker = new FakeWorker()
        workers.push(worker)
        return worker
      },
      // 레인 시계가 타이머보다 0.5ms 늦다 — Chromium의 `performance.now()` 거칠기와 같은 꼴.
      now: () => Date.now() - lag
    })
    for (let i = 0; i < 3; i++) {
      track(client.request(hl('crash ' + i), { cacheable: false }))
      workers.at(-1)!.onerror!({ message: 'startup' })
    }
    const notify = vi.fn()
    client.subscribeRecovery('compute', notify)
    lag = 0.5
    vi.advanceTimersByTime(2_000)
    expect(workers).toHaveLength(3)
    vi.advanceTimersByTime(1)
    expect(workers).toHaveLength(4)
    const check = workers.at(-1)!.posted.at(-1)!
    expect(check).toMatchObject({ type: 'health' })
    workers.at(-1)!.onmessage!({ data: { ok: 'ready', id: check.id } })
    expect(notify).toHaveBeenCalledTimes(1)
  })

  // EP-23 레인 — 계산 오류는 실패 수에 들지 않으므로 두 번 실패한 레인도 열려 있다.
  it('AC20 keeps the lane open after a calculation error that follows two crashes', async () => {
    const h = harness()
    crash(h, 2)
    calculationError(h, 'bad input')
    const next = track(h.client.request(hl('after the error'), { cacheable: false }))
    expect(h.workers).toHaveLength(3)
    h.last().reply(html('ok'))
    await flush()
    expect(next.state.value).toEqual(html('ok'))
  })

  // EP-23 레인 — 확인 요청이 실행 중 작업 때문에 미뤄졌으면 그 작업이 끝날 때 다시 예약한다.
  it('AC20 checks the lane again after a running job ends with a calculation error', () => {
    const h = harness()
    crash(h, 1)
    const notify = vi.fn()
    h.client.subscribeRecovery('compute', notify)
    const running = track(h.client.request(hl('running'), { cacheable: false }))
    vi.advanceTimersByTime(0)
    expect(h.last().posted.some((message) => 'type' in message && message.type === 'health')).toBe(
      false
    )
    const id = h.last().posted.at(-1)!.id
    h.last().onmessage!({ data: { id, ok: false, error: 'bad input' } })
    vi.advanceTimersByTime(0)
    const check = h.last().posted.at(-1)!
    expect(check).toMatchObject({ type: 'health' })
    h.last().onmessage!({ data: { ok: 'ready', id: check.id } })
    expect(notify).toHaveBeenCalledTimes(1)
    running.cancel()
  })

  it('AC20 logs request errors without failing the lane', async () => {
    const log = vi.spyOn(rendererLog, 'warn')
    const h = harness()
    crash(h, 2)
    calculationError(h, 'bad input')
    expect(log.mock.calls.filter(([event]) => event === 'compute.request.failed')).toEqual([
      [
        'compute.request.failed',
        'compute',
        { lane: 'compute', kind: 'highlight', reason: 'bad input' }
      ]
    ])
    expect(h.workers).toHaveLength(3)
    expect(h.client.recoveryEpoch('compute')).toBe(0)
    crash(h)
    await expect(h.client.request(hl('blocked')).promise).rejects.toThrow()
    expect(h.workers).toHaveLength(3)
  })

  it('AC20 throttles repeated reasons', () => {
    const log = vi.spyOn(rendererLog, 'warn')
    const h = harness()
    calculationError(h, 'bad')
    vi.advanceTimersByTime(59_999)
    calculationError(h, 'bad')
    expect(log).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    calculationError(h, 'bad')
    expect(log).toHaveBeenCalledTimes(2)
    calculationError(h, 'different')
    expect(log).toHaveBeenCalledTimes(3)
  })

  it('AC20 reports a slow job once without dropping it', async () => {
    const log = vi.spyOn(rendererLog, 'warn')
    const h = harness()
    const job = h.client.request(hl('slow'))
    vi.advanceTimersByTime(9_999)
    expect(log).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(log).toHaveBeenCalledWith('compute.request.slow', 'compute', {
      lane: 'compute',
      kind: 'highlight',
      reason: 'no-response',
      elapsedMs: 10_000
    })
    vi.advanceTimersByTime(60_000)
    expect(log).toHaveBeenCalledTimes(1)
    h.last().reply(html('late'))
    await expect(job.promise).resolves.toEqual(html('late'))
    succeed(h)
    vi.advanceTimersByTime(60_000)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('marks a running historyBody on a lost worker separately from a worker that fails to start', async () => {
    const req = {
      kind: 'historyBody',
      sequence: 1,
      bytes: 2,
      packet: { offset: 0, base64: 'YQ==' }
    } as const
    const h = harness()
    const first = h.client.request(req)
    h.last().onerror!('lost')
    await expect(first.promise).rejects.toThrow('worker-replaced')
    expect(h.client.workerEpoch('compute')).toBe(1)
    const cold = harness({ failCreate: () => true })
    await expect(cold.client.request(req).promise).rejects.toThrow('compute worker failed')
    expect(cold.client.workerEpoch('compute')).toBe(0)
  })
})
