// 계산 클라이언트 (0324 MD-01 · SD-01). UI 스레드에서 계산을 하지 않고 워커에 요청한다 —
// 워커가 실패해도 여기서 같은 계산을 대신 돌리지 않는다(D-009): 요청은 실패로 끝나고 소비자가
// 원문을 유지한다.
//
// 규칙
//   · 워커에 나가 있는 요청은 1개다.
//   · 대기열은 입력 문자 수 오름차순, 같으면 먼저 온 것.
//   · 같은 키의 요청이 대기·실행 중이면 한 계산을 공유한다. 공유자가 모두 취소해야 취소다.
//   · 대기 중 취소는 대기열에서 뺀다(워커에 보내지 않는다). 실행 중 취소는 대기 요청이 있으면
//     워커를 끝내고 새 워커로 대기열을 잇는다. 대기 요청이 없으면 끝나길 기다려 캐시에만 넣는다.
//   · 워커 생성 실패·`error`·`messageerror` 는 실행 중 요청을 실패시키고 워커를 버린다.
//     연속 `COMPUTE_FAILURE_LIMIT` 회면 이후 요청을 즉시 실패시킨다. 성공 응답이 오면 0 이 된다.
//
// `new Worker(` 는 이 파일에서만 부른다(가드 `check-ui-thread` 규칙 (i)).

import { rendererLog } from '../logging'
import { COMPUTE_CACHE_MAX_CHARS, COMPUTE_FAILURE_LIMIT } from './limits'
import {
  parseResponse,
  requestKey,
  requestSize,
  resultSize,
  type ComputeRequest,
  type ComputeResult,
  type ComputeResults,
  type WireRequest
} from './protocol'

export interface WorkerLike {
  postMessage(message: WireRequest): void
  terminate(): void
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
  onmessageerror: ((event: unknown) => void) | null
}

export interface ComputeHandle<R> {
  promise: Promise<R>
  // 이 소비자가 더는 결과를 원하지 않는다. 늦은 응답은 이 소비자에게 가지 않는다.
  cancel(): void
}

export interface ComputeClient {
  request<K extends ComputeRequest['kind']>(
    request: Extract<ComputeRequest, { kind: K }>
  ): ComputeHandle<ComputeResults[K]>
  // 캐시에 있으면 바로 준다(요청·대기 없음).
  peek<K extends ComputeRequest['kind']>(
    request: Extract<ComputeRequest, { kind: K }>
  ): ComputeResults[K] | undefined
}

export class ComputeCancelled extends Error {
  constructor() {
    super('compute request cancelled')
    this.name = 'ComputeCancelled'
  }
}

interface Waiter {
  resolve: (result: ComputeResult) => void
  reject: (error: Error) => void
}

interface Job {
  id: number
  key: string
  size: number
  request: ComputeRequest
  waiters: Set<Waiter>
}

interface ClientDeps {
  createWorker: () => WorkerLike
  onError?: (error: unknown) => void
  cacheMaxChars?: number
  failureLimit?: number
}

export function createComputeClient(deps: ClientDeps): ComputeClient {
  const cacheMax = deps.cacheMaxChars ?? COMPUTE_CACHE_MAX_CHARS
  const failureLimit = deps.failureLimit ?? COMPUTE_FAILURE_LIMIT
  const onError =
    deps.onError ?? ((error) => rendererLog.error('compute.worker.failed', 'compute', error))

  // Map 의 삽입 순서가 곧 최근 사용 순서다 — 읽을 때 다시 넣어 맨 뒤로 보낸다.
  const cache = new Map<string, { result: ComputeResult; size: number }>()
  let cacheChars = 0
  const queue: Job[] = []
  const jobs = new Map<string, Job>()
  let running: Job | null = null
  let worker: WorkerLike | null = null
  let failures = 0
  let nextId = 1

  const blocked = (): boolean => failures >= failureLimit

  function readCache(key: string): ComputeResult | undefined {
    const hit = cache.get(key)
    if (!hit) return undefined
    cache.delete(key)
    cache.set(key, hit)
    return hit.result
  }

  function writeCache(key: string, result: ComputeResult): void {
    const size = resultSize(result)
    const previous = cache.get(key)
    if (previous) {
      cacheChars -= previous.size
      cache.delete(key)
    }
    cache.set(key, { result, size })
    cacheChars += size
    for (const [oldest, entry] of cache) {
      if (cacheChars <= cacheMax || oldest === key) break
      cache.delete(oldest)
      cacheChars -= entry.size
    }
  }

  function settle(job: Job, outcome: { result: ComputeResult } | { error: Error }): void {
    jobs.delete(job.key)
    for (const waiter of job.waiters) {
      if ('result' in outcome) waiter.resolve(outcome.result)
      else waiter.reject(outcome.error)
    }
    job.waiters.clear()
  }

  function dropWorker(): void {
    if (!worker) return
    worker.onmessage = null
    worker.onerror = null
    worker.onmessageerror = null
    worker.terminate()
    worker = null
  }

  // 워커 수준 실패 — 실행 중 요청을 실패시키고, 한도에 닿았으면 대기열도 비운다.
  function fail(error: unknown): void {
    failures += 1
    onError(error)
    dropWorker()
    const failed = running
    running = null
    const reason = new Error('compute worker failed')
    if (failed) settle(failed, { error: reason })
    if (blocked()) {
      for (const job of queue.splice(0)) settle(job, { error: reason })
      return
    }
    pump()
  }

  function ensureWorker(): WorkerLike | null {
    if (worker) return worker
    try {
      const created = deps.createWorker()
      created.onmessage = (event) => receive(event.data)
      created.onerror = (event) => fail(event)
      created.onmessageerror = (event) => fail(event)
      worker = created
      return created
    } catch (error) {
      fail(error)
      return null
    }
  }

  function pump(): void {
    if (running || queue.length === 0 || blocked()) return
    const job = queue.shift()!
    running = job
    const target = ensureWorker()
    // 생성 실패는 `fail` 이 이미 이 요청을 실패시키고 다음으로 넘어갔다.
    if (!target || running !== job) return
    target.postMessage({ ...job.request, id: job.id })
  }

  function receive(raw: unknown): void {
    const response = parseResponse(raw)
    // 끝낸 워커의 늦은 응답·다른 요청 번호는 버린다.
    if (!response || !running || response.id !== running.id) return
    const job = running
    running = null
    if (response.ok) {
      failures = 0
      writeCache(job.key, response.result)
      settle(job, { result: response.result })
    } else {
      // 요청 하나의 계산 오류(문법 미지원 등)는 워커 실패가 아니다.
      settle(job, { error: new Error(response.error) })
    }
    pump()
  }

  function enqueue(job: Job): void {
    // 크기 오름차순, 같으면 먼저 온 것 뒤에.
    let at = queue.length
    while (at > 0 && queue[at - 1].size > job.size) at -= 1
    queue.splice(at, 0, job)
  }

  function cancel(job: Job, waiter: Waiter): void {
    if (!job.waiters.delete(waiter)) return
    waiter.reject(new ComputeCancelled())
    if (job.waiters.size > 0) return
    const queuedAt = queue.indexOf(job)
    if (queuedAt >= 0) {
      queue.splice(queuedAt, 1)
      jobs.delete(job.key)
      return
    }
    if (running !== job || queue.length === 0) return
    // 실행 중이고 뒤에 기다리는 요청이 있다 — 워커를 바꿔 대기열을 잇는다.
    jobs.delete(job.key)
    running = null
    dropWorker()
    pump()
  }

  return {
    peek(request) {
      return readCache(requestKey(request)) as never
    },
    request(request) {
      const key = requestKey(request)
      const cached = readCache(key)
      if (cached) return { promise: Promise.resolve(cached as never), cancel: () => {} }
      if (blocked()) {
        return { promise: Promise.reject(new Error('compute worker failed')), cancel: () => {} }
      }
      let job = jobs.get(key)
      const isNew = !job
      if (!job) {
        job = { id: nextId++, key, size: requestSize(request), request, waiters: new Set() }
        jobs.set(key, job)
      }
      const owner = job
      let waiter!: Waiter
      const promise = new Promise<ComputeResult>((resolve, reject) => {
        waiter = { resolve, reject }
      })
      owner.waiters.add(waiter)
      if (isNew) {
        enqueue(owner)
        pump()
      }
      return { promise: promise as Promise<never>, cancel: () => cancel(owner, waiter) }
    }
  }
}

let shared: ComputeClient | null = null

// 창마다 하나 — 첫 요청에 워커를 만든다.
export function computeClient(): ComputeClient {
  shared ??= createComputeClient({
    createWorker: () =>
      new Worker(new URL('./worker/compute.worker.ts', import.meta.url), {
        type: 'module',
        name: 'compute'
      }) as unknown as WorkerLike
  })
  return shared
}

// 테스트가 가짜 클라이언트를 넣는다. `null` 이면 다음 호출에서 실제 클라이언트를 다시 만든다.
export function setComputeClient(client: ComputeClient | null): void {
  shared = client
}
