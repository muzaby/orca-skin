import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertValidCron, startCron } from './cron'

const HOUR = 60 * 60 * 1000

beforeEach(() => {
  vi.useFakeTimers()
  // 로컬 12:30 — 다음 정각까지 30분.
  vi.setSystemTime(new Date(2026, 0, 5, 12, 30, 0))
})
afterEach(() => vi.useRealTimers())

describe('startCron', () => {
  it('cron 시각마다 발화하고 다음 발화 시각을 알려준다', async () => {
    const fire = vi.fn()
    const job = startCron('0 * * * *', fire)
    expect(job.nextRun()).toEqual(new Date(2026, 0, 5, 13, 0, 0))
    await vi.advanceTimersByTimeAsync(HOUR / 2 - 1)
    expect(fire).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fire).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(fire).toHaveBeenCalledTimes(2)
    job.stop()
  })

  it('멈춘 뒤에는 발화하지 않고 타이머도 남기지 않는다', async () => {
    const fire = vi.fn()
    const job = startCron('0 * * * *', fire)
    job.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(job.nextRun()).toBeNull()
    await vi.advanceTimersByTimeAsync(3 * HOUR)
    expect(fire).not.toHaveBeenCalled()
  })

  it('요일·시각을 로컬 시각으로 읽는다', () => {
    // 2026-01-05 는 월요일. 화요일(2) 09:30.
    const job = startCron('30 9 * * 2', () => undefined)
    expect(job.nextRun()).toEqual(new Date(2026, 0, 6, 9, 30, 0))
    job.stop()
  })

  it('잘못된 식은 던진다', () => {
    expect(() => startCron('not a cron', () => undefined)).toThrow()
    expect(() => assertValidCron('not a cron')).toThrow(/Invalid scheduler cron expression/)
    expect(() => assertValidCron('0 * * * *')).not.toThrow()
  })
})
