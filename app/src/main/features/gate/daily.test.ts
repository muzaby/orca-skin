import { describe, expect, it, vi } from 'vitest'
import {
  createDayBoundary,
  dailyReloginRequired,
  localDayKey,
  msUntilNextLocalMidnight
} from './daily'

const local = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): number => new Date(year, month - 1, day, hour, minute, second, ms).getTime()

describe('local day and midnight', () => {
  it.each([
    [local(2026, 10, 7), '2026-10-07'],
    [local(2026, 1, 1), '2026-01-01'],
    [local(2026, 12, 31, 23, 59, 59, 999), '2026-12-31']
  ])('formats the local calendar date', (ms, expected) => {
    expect(localDayKey(ms as number)).toBe(expected)
  })

  it.each([
    [local(2026, 10, 7, 23, 59, 59, 999), 1],
    [local(2026, 10, 7), 86_400_000],
    [local(2026, 10, 31, 23, 59), 60_000],
    [local(2026, 12, 31, 23, 59), 60_000]
  ])('schedules the next local midnight', (ms, expected) => {
    expect(msUntilNextLocalMidnight(ms)).toBe(expected)
  })

  it('uses local midnight through daylight saving changes (23h/25h)', () => {
    const prior = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      expect(msUntilNextLocalMidnight(local(2026, 3, 8))).toBe(23 * 3_600_000)
      expect(msUntilNextLocalMidnight(local(2026, 11, 1))).toBe(25 * 3_600_000)
    } finally {
      if (prior === undefined) delete process.env.TZ
      else process.env.TZ = prior
    }
  })
})

describe('daily relogin evidence', () => {
  it.each([
    [undefined, 'valid', true, undefined, false],
    [{ revision: 7, verified: true }, 'valid', true, undefined, true],
    [{ revision: 7, verified: true }, 'valid', true, 7, true],
    [{ revision: 7, verified: true }, 'valid', true, 8, false],
    [{ revision: 7, verified: true }, 'expired', true, 8, true],
    [{ revision: 7, verified: true }, 'valid', false, 8, true],
    [{ revision: 7, verified: false }, 'valid', true, undefined, false],
    [{ revision: 7, verified: false }, 'none', false, undefined, true],
    [{ revision: 7, verified: false }, 'expired', false, undefined, true]
  ] as const)(
    'requires verified login evidence after the boundary',
    (mark, status, verified, revision, expected) => {
      expect(dailyReloginRequired(mark, { status, verified }, revision)).toBe(expected)
    }
  )
})

describe('day boundary lifetime', () => {
  function harness(): {
    boundary: ReturnType<typeof createDayBoundary>
    timers: Map<number, { callback: () => void; ms: number }>
    onDayChanged(): void
    fire(): void
    setNow(value: number): void
  } {
    let now = local(2026, 10, 7, 23, 59, 59)
    let id = 0
    const timers = new Map<number, { callback: () => void; ms: number }>()
    const onDayChanged = vi.fn()
    const boundary = createDayBoundary({
      now: () => now,
      setTimer: (callback, ms) => {
        timers.set(++id, { callback, ms })
        return id
      },
      clearTimer: (handle) => void timers.delete(handle as number),
      onDayChanged
    })
    const fire = (): void => {
      const [handle, timer] = [...timers.entries()][0]!
      timers.delete(handle)
      timer.callback()
    }
    return {
      boundary,
      timers,
      onDayChanged,
      fire,
      setNow: (value: number) => {
        now = value
      }
    }
  }

  it('starts quietly, coalesces same-day checks, and keeps one timer', () => {
    const h = harness()
    h.boundary.check()
    expect(h.timers.size).toBe(0)
    h.boundary.start()
    h.boundary.start()
    expect([...h.timers.values()].map((timer) => timer.ms)).toEqual([1000])
    for (let n = 0; n < 5; n++) h.boundary.check()
    expect(h.onDayChanged).not.toHaveBeenCalled()
    expect(h.timers.size).toBe(1)
  })

  it('notifies once at midnight, after a multi-day jump, and on clock reversal', () => {
    const h = harness()
    h.boundary.start()
    h.setNow(local(2026, 10, 8))
    h.fire()
    expect(h.onDayChanged).toHaveBeenCalledTimes(1)
    h.boundary.check()
    expect(h.onDayChanged).toHaveBeenCalledTimes(1)
    h.setNow(local(2026, 10, 10))
    h.boundary.check()
    expect(h.onDayChanged).toHaveBeenCalledTimes(2)
    h.setNow(local(2026, 10, 9))
    h.boundary.check()
    expect(h.onDayChanged).toHaveBeenCalledTimes(3)
    expect(h.timers.size).toBe(1)
  })

  it('rechecks early timer delivery and schedules the remaining half second', () => {
    const h = harness()
    h.boundary.start()
    h.setNow(local(2026, 10, 7, 23, 59, 59, 500))
    h.fire()
    expect(h.onDayChanged).not.toHaveBeenCalled()
    expect([...h.timers.values()].map((timer) => timer.ms)).toEqual([500])
    h.setNow(local(2026, 10, 8))
    h.fire()
    expect(h.onDayChanged).toHaveBeenCalledTimes(1)
    expect(h.timers.size).toBe(1)
  })

  it('disposes the timer and ignores retained callbacks, checks, and restart', () => {
    const h = harness()
    h.boundary.start()
    const callback = [...h.timers.values()][0]!.callback
    h.boundary.dispose()
    expect(h.timers.size).toBe(0)
    h.setNow(local(2026, 10, 8))
    callback()
    h.boundary.check()
    h.boundary.start()
    expect(h.onDayChanged).not.toHaveBeenCalled()
    expect(h.timers.size).toBe(0)
  })
})
