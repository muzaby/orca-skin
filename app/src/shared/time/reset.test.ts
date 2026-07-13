import { describe, expect, it } from 'vitest'
import { nextMonthReset, nextWeekReset } from './reset'

describe('reset', () => {
  it('nextWeekReset — 항상 다음 월요일 00:00', () => {
    expect(nextWeekReset(new Date(2026, 6, 8))).toEqual(new Date(2026, 6, 13)) // 수요일 기준
    // 오늘이 월요일이어도 이번 주기가 아닌 다음 월요일.
    expect(nextWeekReset(new Date(2026, 6, 6))).toEqual(new Date(2026, 6, 13))
  })

  it('nextMonthReset — 다음 달 1일 00:00 (연 경계 포함)', () => {
    expect(nextMonthReset(new Date(2026, 6, 20))).toEqual(new Date(2026, 7, 1))
    expect(nextMonthReset(new Date(2026, 11, 20))).toEqual(new Date(2027, 0, 1))
  })
})
