import { describe, expect, it } from 'vitest'
import { boundaries } from './boundaries'

describe('cost boundaries', () => {
  it('로컬 타임 기준 일/주(월요일)/월 경계를 계산한다', () => {
    const out = boundaries(new Date(2026, 5, 10, 15, 30, 45, 123))

    expect(out).toEqual({
      dayStart: new Date(2026, 5, 10).getTime(),
      weekStart: new Date(2026, 5, 8).getTime(),
      monthStart: new Date(2026, 5, 1).getTime()
    })
  })

  it('일요일은 직전 월요일을 주 경계로 사용한다', () => {
    expect(boundaries(new Date(2026, 5, 14, 1)).weekStart).toBe(new Date(2026, 5, 8).getTime())
  })
})
