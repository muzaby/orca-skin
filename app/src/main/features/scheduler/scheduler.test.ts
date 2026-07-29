import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// interval 스펙(0156) — "앱 시작 시각 기준 N시간" 은 cron 으로 표현할 수 없어 별도 경로다.
describe('Scheduler — interval jobs', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires repeatedly at the interval, first run one period after scheduling', async () => {
    const action = vi.fn()
    const scheduler = new Scheduler(new MemoryRecorder())
    scheduler.register('update-check', action)

    scheduler.schedule('update-check', { intervalMs: 6 * 60 * 60 * 1000, enabled: true })

    // 시작 직후에는 발화하지 않는다 — 시작 시 1회 확인은 컴포지션 루트가 따로 수행하므로
    // 여기서 즉시 발화하면 부팅 시 두 번 확인하게 된다.
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000 - 1)
    expect(action).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(action).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000)
    expect(action).toHaveBeenCalledTimes(3)

    scheduler.stopAll()
  })

  it('does not schedule when disabled, and unschedules a previously enabled job', async () => {
    const action = vi.fn()
    const scheduler = new Scheduler(new MemoryRecorder())
    scheduler.register('update-check', action)

    scheduler.schedule('update-check', { intervalMs: 1000, enabled: false })
    await vi.advanceTimersByTimeAsync(5000)
    expect(action).not.toHaveBeenCalled()
    expect(scheduler.nextRun('update-check')).toBeNull()

    scheduler.schedule('update-check', { intervalMs: 1000, enabled: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(action).toHaveBeenCalledTimes(1)

    scheduler.schedule('update-check', { intervalMs: 1000, enabled: false })
    await vi.advanceTimersByTimeAsync(5000)
    expect(action).toHaveBeenCalledTimes(1)

    scheduler.stopAll()
  })

  it('stopAll clears the interval timer', async () => {
    const action = vi.fn()
    const scheduler = new Scheduler(new MemoryRecorder())
    scheduler.register('update-check', action)
    scheduler.schedule('update-check', { intervalMs: 1000, enabled: true })

    scheduler.stopAll()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(action).not.toHaveBeenCalled()
  })

  it('rejects a non-positive or non-integer interval', () => {
    const scheduler = new Scheduler(new MemoryRecorder())
    scheduler.register('update-check', vi.fn())

    expect(() => scheduler.schedule('update-check', { intervalMs: 0 })).toThrow(
      'Invalid scheduler interval'
    )
    expect(() => scheduler.schedule('update-check', { intervalMs: -1000 })).toThrow(
      'Invalid scheduler interval'
    )
    expect(() => scheduler.schedule('update-check', { intervalMs: 1.5 })).toThrow(
      'Invalid scheduler interval'
    )
    scheduler.stopAll()
  })

  it('records interval runs and skips an overlapping run', async () => {
    const recorder = new MemoryRecorder()
    const scheduler = new Scheduler(recorder)
    let release: (() => void) | undefined
    scheduler.register(
      'update-check',
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    scheduler.schedule('update-check', { intervalMs: 1000, enabled: true })

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
    release?.()
    await vi.advanceTimersByTimeAsync(0)

    expect(recorder.rows.map((r) => r.jobKey)).toEqual(['update-check', 'update-check'])
    expect(recorder.rows[1]).toMatchObject({
      status: 'skipped',
      error: 'Previous run is still active'
    })

    scheduler.stopAll()
  })

  it('applySettings drives both the cron and the interval job from settings', async () => {
    const usage = vi.fn()
    const update = vi.fn()
    const scheduler = new Scheduler(new MemoryRecorder())
    scheduler.register('usage-recompute', usage)
    scheduler.register('update-check', update)

    scheduler.applySettings({
      usageRecompute: { enabled: false, cron: '0 */1 * * *' },
      updateCheck: { enabled: true, intervalHours: 6 }
    })

    expect(scheduler.nextRun('usage-recompute')).toBeNull()
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(update).toHaveBeenCalledTimes(1)

    // 설정을 끄면 재적용(설정 저장 경로)만으로 주기 확인이 멈춘다.
    scheduler.applySettings({
      usageRecompute: { enabled: false, cron: '0 */1 * * *' },
      updateCheck: { enabled: false, intervalHours: 6 }
    })
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    expect(update).toHaveBeenCalledTimes(1)

    scheduler.stopAll()
  })
})
