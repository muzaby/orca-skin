import type { DbQueries } from '../../infra/db'
import type { HistoryPrepared } from '../../../shared/history-page'
import { getLogger } from '../../infra/log/registry'
import { localMessages } from './native-projection'
import { readHistorySource, type HistorySource } from './reader'

type JobResult = { generation: string; prepared?: HistoryPrepared } | undefined
interface Job {
  id: string
  queued: number
  started?: number
  source?: HistorySource
  generation?: string
  foreground: boolean
  promise: Promise<JobResult>
  resolve: (result: JobResult) => void
  reject: (error: unknown) => void
}

// Only one slice runs on the data host at a time. A foreground read can also join a
// background job between slices. next_ordinal and the rows advance in one transaction.
export class HistoryIndex {
  private queue: Job[] = []
  private jobs = new Map<string, Job>()
  private scheduled = false
  private stopped = false
  constructor(private readonly db: DbQueries) {}

  startBackground(): void {
    for (const id of this.db.historyIndex.pendingSessions())
      void this.prepare(id, false).catch((error: unknown) => {
        getLogger()
          .child('history')
          .warn('history.index.unavailable', {
            errorType: error instanceof Error ? error.name : 'unknown'
          })
      })
  }
  stop(): void {
    this.stopped = true
    for (const job of this.jobs.values()) job.resolve(undefined)
    this.jobs.clear()
    this.queue = []
  }
  prepare(id: string, foreground = true): Promise<JobResult> {
    if (this.stopped) return Promise.resolve(undefined)
    const state = this.db.historyIndex.state(id)
    if (state?.published && state.published_revision === state.revision)
      return Promise.resolve({ generation: state.published })
    const pending = this.jobs.get(id)
    if (pending) {
      if (foreground && !pending.foreground) {
        this.queue = this.queue.filter((job) => job !== pending)
        pending.foreground = true
        this.queue.unshift(pending)
      }
      return pending.promise
    }
    let resolve!: Job['resolve'], reject!: Job['reject']
    const promise = new Promise<JobResult>((ok, err) => {
      resolve = ok
      reject = err
    })
    const job: Job = { id, queued: performance.now(), foreground, promise, resolve, reject }
    this.jobs.set(id, job)
    if (foreground) this.queue.unshift(job)
    else this.queue.push(job)
    this.schedule()
    return promise
  }

  private schedule(): void {
    if (this.scheduled || this.stopped || !this.queue.length) return
    this.scheduled = true
    setImmediate(() => {
      this.scheduled = false
      const job = this.queue.shift()
      if (!job || this.stopped) return
      try {
        const index = this.db.historyIndex
        const state = index.read(() => {
          const current = index.state(job.id)
          const tail = current && index.localTail(job.id, current)
          if (tail) {
            index.appendTail(
              job.id,
              current!,
              localMessages(tail.parts, tail.headers),
              tail.headers
            )
            return index.state(job.id)
          }
          return index.begin(job.id)
        })
        job.started ??= performance.now()
        if (!state || !state.building) {
          this.jobs.delete(job.id)
          job.resolve(state?.published ? { generation: state.published } : undefined)
        } else {
          if (job.generation !== state.building || !job.source) {
            job.generation = state.building
            job.source = readHistorySource(this.db, job.id, undefined, index.headers(job.id))
          }
          const result = index.writeSlice(job.id, state.building, state.revision, job.source)
          if (result === 'published') {
            this.jobs.delete(job.id)
            job.resolve({
              generation: state.building,
              prepared: {
                queuedMs: job.started - job.queued,
                buildMs: performance.now() - job.started,
                sourceBytes: job.source.sourceBytes
              }
            })
          } else {
            // Round robin among waiting foreground readers. Preserve recent-first background order.
            const next = this.queue.findIndex((other) => !other.foreground)
            this.queue.splice(next < 0 ? this.queue.length : next, 0, job)
          }
        }
      } catch (error) {
        this.jobs.delete(job.id)
        job.reject(error)
      }
      this.schedule()
    })
  }
}
