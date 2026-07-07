import { describe, expect, it } from 'vitest'
import { monthResetLabel, weekResetLabel } from './resetLabels'

describe('resetLabels', () => {
  it('weekResetLabel — 항상 다음 월요일 00:00', () => {
    expect(weekResetLabel(new Date(2026, 6, 8))).toBe('(월) 오전 0:00에 재설정') // 수요일 기준
    // 월요일 당일이면 다음 주 월요일(이번 주기가 아님).
    expect(weekResetLabel(new Date(2026, 6, 6))).toBe('(월) 오전 0:00에 재설정')
  })

  it('monthResetLabel — 다음 달 1일 + 실제 요일', () => {
    // 2026-07 → 2026-08-01 은 토요일.
    expect(monthResetLabel(new Date(2026, 6, 20))).toBe('(토) 8월 1일에 재설정')
    // 12월 → 다음 해 1월 1일.
    expect(monthResetLabel(new Date(2026, 11, 20))).toBe(
      `(${['일', '월', '화', '수', '목', '금', '토'][new Date(2027, 0, 1).getDay()]}) 1월 1일에 재설정`
    )
  })
})
