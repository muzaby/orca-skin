import { describe, expect, it } from 'vitest'
import { boundaries, daysInMonth, monthDaysLeft, weekDaysLeft } from './clock'

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

  it('monthDaysLeft — 오늘 포함 이달 남은 일수', () => {
    expect(monthDaysLeft(new Date(2026, 6, 15))).toBe(31 - 15 + 1) // 17
    expect(monthDaysLeft(new Date(2026, 6, 31))).toBe(1) // 말일 당일
    expect(monthDaysLeft(new Date(2026, 6, 1))).toBe(31) // 월초
  })

  it('weekDaysLeft — 오늘 포함 이번 주 남은 일수(월=7 … 일=1)', () => {
    expect(weekDaysLeft(new Date(2026, 6, 6))).toBe(7) // 2026-07-06 월요일
    expect(weekDaysLeft(new Date(2026, 6, 8))).toBe(5) // 수요일 → 수목금토일
    expect(weekDaysLeft(new Date(2026, 6, 12))).toBe(1) // 일요일
  })
})
