import { describe, expect, it, vi } from 'vitest'
import { Scheduler } from './scheduler'
import type { RunRecorder, ScheduleRunStatus } from './types'

class MemoryRecorder implements RunRecorder {
  rows: {
    id: number
    jobKey: string
    startedAt: number
    finishedAt?: number
    status: ScheduleRunStatus
    error?: string | null
  }[] = []

  start(jobKey: string, startedAt: number): number {
    const id = this.rows.length + 1
    this.rows.push({ id, jobKey, startedAt, status: 'running' })
    return id
  }

  finish(
    id: number,
    finishedAt: number,
    status: Exclude<ScheduleRunStatus, 'running'>,
    error?: string | null
  ): void {
    const row = this.rows.find((r) => r.id === id)
    if (!row) throw new Error('missing row')
    row.finishedAt = finishedAt
    row.status = status
    row.error = error
  }
}

describe('Scheduler', () => {
  it('registers a cron schedule and exposes nextRun', () => {
    const recorder = new MemoryRecorder()
    const scheduler = new Scheduler(recorder)
    scheduler.register('usage-recompute', () => {})

    scheduler.schedule('usage-recompute', { cron: '0 */1 * * *', enabled: true })

    expect(scheduler.nextRun('usage-recompute')).toBeInstanceOf(Date)
    scheduler.stopAll()
  })

  it('records success and error runs', async () => {
    let now = 100
    const recorder = new MemoryRecorder()
    const scheduler = new Scheduler(recorder, () => now++)
    scheduler.register('usage-recompute', () => {})
    scheduler.register('failing', () => {
      throw new Error('boom')
    })

    await scheduler.runNow('usage-recompute')
    await scheduler.runNow('failing')

    expect(recorder.rows).toMatchObject([
      { jobKey: 'usage-recompute', status: 'success', error: null },
      { jobKey: 'failing', status: 'error', error: 'boom' }
    ])
  })

  it('records skipped when the same job overlaps', async () => {
    const recorder = new MemoryRecorder()
    let release: (() => void) | undefined
    const scheduler = new Scheduler(recorder)
    scheduler.register(
      'usage-recompute',
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )

    const first = scheduler.runNow('usage-recompute')
    await scheduler.runNow('usage-recompute')
    release?.()
    await first

    expect(recorder.rows.map((r) => r.status)).toEqual(['success', 'skipped'])
  })

  it('disposes scheduled jobs and prevents later registration', () => {
    const scheduler = new Scheduler(new MemoryRecorder())
    scheduler.register('usage-recompute', vi.fn())
    scheduler.schedule('usage-recompute', { cron: '0 */1 * * *', enabled: true })

    scheduler.stopAll()

    expect(scheduler.nextRun('usage-recompute')).toBeNull()
    expect(() => scheduler.register('other', vi.fn())).toThrow('Scheduler is disposed')
  })
})
