// 계산 클라이언트 (0324 MD-01 · SD-01). UI 스레드에서 계산을 하지 않고 워커에 요청한다 —
// 워커가 실패해도 여기서 같은 계산을 대신 돌리지 않는다(D-009): 요청은 실패로 끝나고 소비자가
// 원문을 유지한다.
//
// 규칙
//   · 계산·Markdown 레인마다 워커에 나가 있는 요청은 1개다.
//   · 대기열은 양보 횟수, 작업 크기 순이며 동률이면 먼저 온 요청을 보낸다.
//   · 같은 키의 요청이 대기·실행 중이면 한 계산을 공유한다. 공유자가 모두 취소해야 취소다.
//   · 대기 중 취소는 대기열에서 뺀다(워커에 보내지 않는다). 실행 중 취소는 대기 요청이 있으면
//     워커를 끝내고 새 워커로 대기열을 잇는다. 대기 요청이 없으면 끝나길 기다려 캐시에만 넣는다.
//   · 워커 생성 실패·`error`·`messageerror` 는 실행 중 요청을 실패시키고 워커를 버린다.
//     연속 `COMPUTE_FAILURE_LIMIT` 회면 이후 요청을 즉시 실패시킨다. 성공 응답이 오면 0 이 된다.
//
// `new Worker(` 는 이 파일에서만 부른다(가드 `check-ui-thread` 규칙 (i)).

import { rendererLog } from '../logging'
import {
  COMPUTE_DOC_MAX_CHARS,
  TOKENS_RANGE_MAX_LINES,
  COMPUTE_CACHE_MAX_CHARS,
  COMPUTE_CACHE_MAX_ENTRIES,
  COMPUTE_FAILURE_LIMIT
} from './limits'
import {
  docKey,
  laneOf,
  type Lane,
  type DocRef,
  type WireControl,
  parseResponse,
  requestKey,
  requestSize,
  type ComputeRequest,
  type ComputeResult,
  type ComputeResults,
  type WireRequest
} from './protocol'

export interface WorkerLike {
  postMessage(message: WireRequest | WireControl): void
  terminate(): void
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
  onmessageerror: ((event: unknown) => void) | null
}

export type Priority = 'visible' | 'background'
export interface ComputeJobTiming {
  kind: ComputeRequest['kind']
  lane: Lane
  priority: Priority
  yields: number
  key: string
  enqueuedAt: number
  startedAt: number
  endedAt: number
}
export interface ComputeHandle<R> {
  promise: Promise<R>
  // 이 소비자가 더는 결과를 원하지 않는다. 늦은 응답은 이 소비자에게 가지 않는다.
  cancel(): void
  setPriority(priority: Priority): void
}

function settledHandle<R>(promise: Promise<R>): ComputeHandle<R> {
  return { promise, cancel: () => {}, setPriority: () => {} }
}

export interface DocumentLease {
  readonly ref: DocRef
  readonly available: boolean
  onAvailable(listener: () => void): () => void
  release(): void
}

export interface ComputeClient {
  openDocument(ref: DocRef, payload: { text: string }, lane: Lane): DocumentLease
  request<K extends ComputeRequest['kind']>(
    request: Extract<ComputeRequest, { kind: K }>,
    options?: { cacheable?: boolean; priority?: Priority }
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
  priority: Priority
  resolve: (result: ComputeResult) => void
  reject: (error: Error) => void
}

interface Job {
  id: number
  key: string
  size: number
  request: ComputeRequest
  cacheable: boolean
  priority: Priority
  enqueuedAt: number
  startedAt: number
  startedPriority: Priority
  order: number
  yields: number
  resumeFrom?: number
  retried: boolean
  waiters: Set<Waiter>
}

interface ClientDeps {
  now?: () => number
  timings?: (timing: ComputeJobTiming) => void
  docMaxChars?: number
  createWorker: (lane: Lane) => WorkerLike
  onError?: (error: unknown) => void
  cacheMaxChars?: number
  cacheMaxEntries?: number
  failureLimit?: number
}

export function createComputeClient(deps: ClientDeps): ComputeClient {
  const compute = createLane(deps, 'compute')
  const markdown = createLane(deps, 'markdown')
  const select = (lane: Lane): ComputeClient => (lane === 'markdown' ? markdown : compute)
  return {
    openDocument: (ref, payload, lane) => select(lane).openDocument(ref, payload, lane),
    request: (request, options) => select(laneOf(request.kind)).request(request, options),
    peek: (request) => select(laneOf(request.kind)).peek(request)
  }
}

function createLane(deps: ClientDeps, lane: Lane): ComputeClient {
  const documents = new Map<
    string,
    {
      ref: DocRef
      text: string
      leases: number
      available: boolean
      sent: boolean
      listeners: Set<() => void>
    }
  >()
  const capacity = deps.docMaxChars ?? COMPUTE_DOC_MAX_CHARS
  let reserved = 0
  const cacheMax = deps.cacheMaxChars ?? COMPUTE_CACHE_MAX_CHARS
  const cacheMaxEntries = deps.cacheMaxEntries ?? COMPUTE_CACHE_MAX_ENTRIES
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
  const now = deps.now ?? (() => performance.now())
  let nextId = 1
  // 취소된 커서는 다음 전송에 함께 정리한다. 문서가 먼저 닫히면 워커가 즉시 해제한다.
  const discard: number[] = []

  const blocked = (): boolean => failures >= failureLimit

  function readCache(key: string): ComputeResult | undefined {
    const hit = cache.get(key)
    if (!hit) return undefined
    cache.delete(key)
    cache.set(key, hit)
    return hit.result
  }

  // 항목 비용 = 요청 키 길이 + 워커가 센 결과 크기(0325 D-038 · EP-5 ④). 크기가 무효하거나 비용이 상한을
  // 넘는 결과는 넣지 않고 기존 항목도 밀어내지 않는다 — 요청자는 결과를 그대로 받는다.
  function writeCache(key: string, result: ComputeResult, size: number): void {
    if (!Number.isFinite(size) || size < 0) return
    const cost = key.length + size
    if (cost > cacheMax) return
    const previous = cache.get(key)
    if (previous) {
      cacheChars -= previous.size
      cache.delete(key)
    }
    cache.set(key, { result, size: cost })
    cacheChars += cost
    for (const [oldest, entry] of cache) {
      if (cacheChars <= cacheMax && cache.size <= cacheMaxEntries) break
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
    collectDocuments()
  }

  function collectDocuments(): void {
    for (const [key, doc] of documents) {
      if (doc.leases > 0) continue
      if ([...jobs.values()].some(({ request }) => 'doc' in request && docKey(request.doc) === key))
        continue
      documents.delete(key)
      if (doc.available) reserved -= doc.text.length
      if (doc.sent) worker?.postMessage({ type: 'doc.close', ref: doc.ref })
    }
    for (const doc of documents.values()) {
      if (doc.available || reserved + doc.text.length > capacity) continue
      doc.available = true
      reserved += doc.text.length
      const listeners = [...doc.listeners]
      doc.listeners.clear()
      for (const listener of listeners) listener()
    }
  }

  function dropWorker(): void {
    if (!worker) return
    worker.onmessage = null
    worker.onerror = null
    worker.onmessageerror = null
    worker.terminate()
    worker = null
    for (const doc of documents.values()) doc.sent = false
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
      const created = deps.createWorker(lane)
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
    try {
      if ('doc' in job.request) {
        const doc = documents.get(docKey(job.request.doc))!
        if (!doc.sent) {
          target.postMessage({ type: 'doc.open', ref: doc.ref, text: doc.text })
          doc.sent = true
        }
      }
      if (deps.timings) {
        job.startedPriority = job.priority
        job.startedAt = now()
      }
      target.postMessage({
        ...job.request,
        id: job.id,
        ...(job.resumeFrom !== undefined && { resumeFrom: job.resumeFrom }),
        ...(discard.length > 0 && { discard: discard.splice(0) })
      })
      job.resumeFrom = undefined
    } catch (error) {
      fail(error)
    }
  }

  function receive(raw: unknown): void {
    const response = parseResponse(raw)
    // 끝낸 워커의 늦은 응답·다른 요청 번호는 버린다.
    if (!response || !running || response.id !== running.id) return
    const job = running
    running = null
    deps.timings?.({
      kind: job.request.kind,
      lane,
      priority: job.startedPriority,
      yields: job.yields,
      key: job.key,
      enqueuedAt: job.enqueuedAt,
      startedAt: job.startedAt,
      endedAt: now()
    })
    if (response.ok === true) {
      failures = 0
      if (job.cacheable) writeCache(job.key, response.result, response.size)
      settle(job, { result: response.result })
    } else if (response.ok === 'continue') {
      if (job.request.kind !== 'tokens') {
        running = job
        fail(new Error('unexpected continuation'))
        return
      }
      failures = 0
      if (job.waiters.size) {
        job.resumeFrom = job.id
        job.id = nextId++
        job.yields++
        enqueue(job)
      } else {
        discard.push(job.id)
        settle(job, { error: new ComputeCancelled() })
      }
    } else if (response.error === 'unknown-doc' && !job.retried && 'doc' in job.request) {
      job.retried = true
      documents.get(docKey(job.request.doc))!.sent = false
      enqueue(job)
    } else {
      // 요청 하나의 계산 오류(문법 미지원 등)는 워커 실패가 아니다.
      settle(job, { error: new Error(response.error) })
    }
    pump()
  }

  function enqueue(job: Job): void {
    if (deps.timings) job.enqueuedAt = now()
    insert(job)
  }

  function compare(a: Job, b: Job): number {
    return (
      Number(a.priority === 'background') - Number(b.priority === 'background') ||
      a.yields - b.yields ||
      a.size - b.size ||
      a.order - b.order
    )
  }

  function insert(job: Job): void {
    let at = queue.length
    while (at > 0 && compare(queue[at - 1], job) > 0) at--
    queue.splice(at, 0, job)
  }

  function refreshPriority(job: Job): void {
    const priority = [...job.waiters].some((waiter) => waiter.priority === 'visible')
      ? 'visible'
      : 'background'
    if (job.priority === priority) return
    job.priority = priority
    const at = queue.indexOf(job)
    if (at >= 0) {
      queue.splice(at, 1)
      insert(job)
    }
  }

  function cancel(job: Job, waiter: Waiter): void {
    if (!job.waiters.delete(waiter)) return
    waiter.reject(new ComputeCancelled())
    if (job.waiters.size > 0) {
      refreshPriority(job)
      return
    }
    const queuedAt = queue.indexOf(job)
    if (queuedAt >= 0) {
      if (job.resumeFrom !== undefined) discard.push(job.resumeFrom)
      queue.splice(queuedAt, 1)
      jobs.delete(job.key)
      collectDocuments()
      return
    }
    if (running !== job || queue.length === 0 || 'doc' in job.request) return
    // 실행 중이고 뒤에 기다리는 요청이 있다 — 워커를 바꿔 대기열을 잇는다.
    jobs.delete(job.key)
    running = null
    dropWorker()
    pump()
  }

  return {
    openDocument(ref, payload) {
      const key = docKey(ref)
      let entry = documents.get(key)
      if (!entry) {
        const available = reserved + payload.text.length <= capacity
        entry = { ref, text: payload.text, available, sent: false, leases: 0, listeners: new Set() }
        if (available) reserved += payload.text.length
        documents.set(key, entry)
      }
      const doc = entry
      doc.leases++
      let released = false
      const subscriptions = new Set<() => void>()
      return {
        ref,
        get available() {
          return doc.available && !released
        },
        onAvailable(listener) {
          const notify = (): void => listener()
          if (!released && !doc.available) {
            subscriptions.add(notify)
            doc.listeners.add(notify)
          }
          return () => {
            subscriptions.delete(notify)
            doc.listeners.delete(notify)
          }
        },
        release() {
          if (released) return
          released = true
          for (const listener of subscriptions) doc.listeners.delete(listener)
          doc.leases--
          collectDocuments()
        }
      }
    },
    peek(request) {
      return readCache(requestKey(request)) as never
    },
    request(request, options) {
      const input: ComputeRequest = request
      if (input.kind === 'tokens') {
        const { start, end } = input
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start)
          return settledHandle(Promise.reject(Error('range-invalid')))
        if (end - start > TOKENS_RANGE_MAX_LINES)
          return settledHandle(Promise.reject(Error('range-too-large')))
      }
      if ('doc' in request && !documents.get(docKey(request.doc))?.available)
        return settledHandle(Promise.reject(new Error('doc-unavailable')))

      const key = requestKey(request)
      const cached = options?.cacheable === false ? undefined : readCache(key)
      if (cached) return settledHandle(Promise.resolve(cached as never))
      if (blocked()) {
        return settledHandle(Promise.reject(new Error('compute worker failed')))
      }
      let job = jobs.get(key)
      const isNew = !job
      if (!job) {
        const id = nextId++
        job = {
          id,
          key,
          size: requestSize(request),
          request,
          cacheable: options?.cacheable !== false,
          order: id,
          priority: options?.priority ?? 'visible',
          startedPriority: options?.priority ?? 'visible',
          startedAt: 0,
          enqueuedAt: 0,
          yields: 0,
          retried: false,
          waiters: new Set()
        }
        jobs.set(key, job)
      }
      const owner = job
      let waiter!: Waiter
      const promise = new Promise<ComputeResult>((resolve, reject) => {
        waiter = { resolve, reject, priority: options?.priority ?? 'visible' }
      })
      owner.waiters.add(waiter)
      refreshPriority(owner)
      if (isNew) {
        enqueue(owner)
        pump()
      }
      return {
        promise: promise as Promise<never>,
        cancel: () => cancel(owner, waiter),
        setPriority(priority) {
          if (!owner.waiters.has(waiter)) return
          waiter.priority = priority
          refreshPriority(owner)
        }
      }
    }
  }
}

let shared: ComputeClient | null = null

// 창마다 하나 — 첫 요청에 워커를 만든다.
export function computeClient(): ComputeClient {
  shared ??= createComputeClient({
    createWorker: (lane) =>
      lane === 'markdown'
        ? (new Worker(new URL('./worker/markdown.worker.ts', import.meta.url), {
            type: 'module',
            name: 'markdown'
          }) as unknown as WorkerLike)
        : (new Worker(new URL('./worker/compute.worker.ts', import.meta.url), {
            type: 'module',
            name: 'compute'
          }) as unknown as WorkerLike)
  })
  return shared
}

// 테스트가 가짜 클라이언트를 넣는다. `null` 이면 다음 호출에서 실제 클라이언트를 다시 만든다.
export function setComputeClient(client: ComputeClient | null): void {
  shared = client
}
