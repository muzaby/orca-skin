import { describe, expect, it } from 'vitest'
import { boundaries, daysInMonth, weekDaysInMonth } from './clock'

describe('clock', () => {
  it('boundaries — 로컬타임 day/week/month 시작 epoch ms', () => {
    const now = new Date(2026, 5, 10, 15, 30).getTime() // 2026-06-10 수요일
    expect(boundaries(now)).toEqual({
      dayStart: new Date(2026, 5, 10).getTime(),
      weekStart: new Date(2026, 5, 8).getTime(), // 직전 월요일
      monthStart: new Date(2026, 5, 1).getTime()
    })
  })

  it('daysInMonth — 달별 말일', () => {
    expect(daysInMonth(new Date(2026, 6, 15))).toBe(31) // 7월
    expect(daysInMonth(new Date(2026, 1, 15))).toBe(28) // 2026-02 (평년)
    expect(daysInMonth(new Date(2024, 1, 15))).toBe(29) // 2024-02 (윤년)
  })

  it('weekDaysInMonth — 이번 주 중 이달에 속한 일수(경계 주는 이달 몫만)', () => {
    expect(weekDaysInMonth(new Date(2026, 6, 15))).toBe(7) // 7/13~7/19 전부 7월
    expect(weekDaysInMonth(new Date(2026, 6, 30))).toBe(5) // 7/27~8/2 주의 7월 몫(27~31)
    expect(weekDaysInMonth(new Date(2026, 7, 1))).toBe(2) // 같은 주의 8월 몫(8/1~8/2)
  })
})
