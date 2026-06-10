import { describe, expect, it } from 'vitest'
import { boundaries } from './boundaries'

describe('boundaries', () => {
  it('로컬타임 기준 day/week/month 시작 epoch ms를 계산한다', () => {
    const now = new Date(2026, 5, 10, 15, 30, 45, 123).getTime()
    expect(boundaries(now)).toEqual({
      dayStart: new Date(2026, 5, 10).getTime(),
      weekStart: new Date(2026, 5, 8).getTime(),
      monthStart: new Date(2026, 5, 1).getTime()
    })
  })

  it('일요일은 직전 월요일을 weekStart 로 잡는다', () => {
    const now = new Date(2026, 5, 14, 12).getTime()
    expect(boundaries(now).weekStart).toBe(new Date(2026, 5, 8).getTime())
  })
})
