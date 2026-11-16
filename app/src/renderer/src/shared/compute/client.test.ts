// 계산 클라이언트의 대기열·캐시·취소·실패 (0324 AC11~AC14 · MD-01 · SD-01).
// 가짜 워커를 주입한다 — 무엇이 워커에 나갔고 언제 끝났는지를 기록으로 본다.

import { describe, expect, it } from 'vitest'
import {
  ComputeCancelled,
  createComputeClient,
  type ComputeClient,
  type WorkerLike
} from './client'
import type { ComputeResult, WireRequest } from './protocol'

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
  // 마지막으로 받은 요청에 답한다.
  reply(result: ComputeResult, at = this.posted.length - 1): void {
    this.onmessage?.({ data: { id: this.posted[at].id, ok: true, result } })
  }
}

interface Harness {
  client: ComputeClient
  workers: FakeWorker[]
  errors: unknown[]
  last(): FakeWorker
}

function harness(options: { cacheMaxChars?: number; failCreate?: () => boolean } = {}): Harness {
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
    cacheMaxChars: options.cacheMaxChars
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

  it('결과 문자 수 합이 상한을 넘으면 가장 오래 안 쓴 것부터 버린다', () => {
    const h = harness({ cacheMaxChars: 10 })
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
    const h = harness({ cacheMaxChars: 8 })
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

  it('실행 중 요청이 취소되고 대기 요청이 있으면 워커를 끝내고 새 워커에 대기 요청을 보낸다', async () => {
    const h = harness()
    const run = track(h.client.request(hl('run')))
    const queued = track(h.client.request(hl('queued')))
    const first = h.last()
    run.cancel()
    expect(first.terminated).toBe(1)
    expect(h.workers).toHaveLength(2)
    expect(h.last().posted.map(codeOf)).toEqual(['queued'])
    // 끝낸 워커의 늦은 응답은 어디에도 반영되지 않는다.
    first.onmessage?.({ data: { id: first.posted[0].id, ok: true, result: html('<late>') } })
    h.last().reply(html('<q>'))
    await flush()
    expect(run.state.error).toBeInstanceOf(ComputeCancelled)
    expect(run.state.value).toBeUndefined()
    expect(queued.state.value).toEqual({ html: '<q>' })
    expect(h.client.peek(hl('run'))).toBeUndefined()
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
    expect(h.workers).toHaveLength(2)
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
