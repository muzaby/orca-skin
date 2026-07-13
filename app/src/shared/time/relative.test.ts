import { describe, it, expect } from 'vitest'
import { relativeTime } from './relative'

describe('relativeTime', () => {
  const now = 1_000_000_000_000

  it('1분 미만은 now', () => {
    expect(relativeTime(now, now)).toEqual({ unit: 'now', value: 0 })
    expect(relativeTime(now - 59_000, now)).toEqual({ unit: 'now', value: 0 })
  })

  it('미래(then>now)도 now 로 클램프', () => {
    expect(relativeTime(now + 5_000, now)).toEqual({ unit: 'now', value: 0 })
  })

  it('분 단위', () => {
    expect(relativeTime(now - 60_000, now)).toEqual({ unit: 'minute', value: 1 })
    expect(relativeTime(now - 59 * 60_000, now)).toEqual({ unit: 'minute', value: 59 })
  })

  it('시간 단위', () => {
    expect(relativeTime(now - 60 * 60_000, now)).toEqual({ unit: 'hour', value: 1 })
    expect(relativeTime(now - 23 * 60 * 60_000, now)).toEqual({ unit: 'hour', value: 23 })
  })

  it('일 단위', () => {
    expect(relativeTime(now - 24 * 60 * 60_000, now)).toEqual({ unit: 'day', value: 1 })
    expect(relativeTime(now - 3 * 24 * 60 * 60_000, now)).toEqual({ unit: 'day', value: 3 })
  })
})
