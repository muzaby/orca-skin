import { describe, expect, it } from 'vitest'
import type { CostPeriodSummary, CostSummary } from '../ipc'
import { computeUsageLimits } from './limits'

function period(totalCostUsd: number): CostPeriodSummary {
  return {
    totalCostUsd,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0
  }
}

function summary(dayUsd: number, weekUsd: number, monthUsd: number): CostSummary {
  return { day: period(dayUsd), week: period(weekUsd), month: period(monthUsd), updatedAt: 0 }
}

const JUL_15_WED = new Date(2026, 6, 15, 12) // 수요일

describe('computeUsageLimits', () => {
  it('워크드 예시 — L=$90, 7/15(수), 월사용 $30, 주사용 $8 → 주간≈31%·월간≈33%', () => {
    const v = computeUsageLimits(summary(0, 8, 30), 90, JUL_15_WED)
    // monthDaysLeft=17, remaining=60, perDay≈3.529, weekDaysLeft=5, weekBudget≈25.65
    expect(v.month.pct).toBeCloseTo(30 / 90, 5)
    expect(v.week.pct).toBeCloseTo(8 / (8 + (60 / 17) * 5), 5)
    expect(v.week.pct).toBeGreaterThan(0.3)
    expect(v.week.pct).toBeLessThan(0.32)
    expect(v.month.budget).toBe(90)
    expect(v.month.unlimited).toBe(false)
    expect(v.month.resetLabel).toBe('(토) 8월 1일에 재설정')
    expect(v.week.resetLabel).toBe('(월) 오전 0:00에 재설정')
  })

  it('무제한(null) — 예산·퍼센트 없이 사용액만', () => {
    const v = computeUsageLimits(summary(0, 8, 30), null, JUL_15_WED)
    expect(v.week).toMatchObject({ used: 8, budget: null, pct: 0, unlimited: true })
    expect(v.month).toMatchObject({ used: 30, budget: null, pct: 0, unlimited: true })
  })

  it('0 이하 한도 = 무제한 취급', () => {
    const v = computeUsageLimits(summary(0, 0, 0), 0, JUL_15_WED)
    expect(v.month.unlimited).toBe(true)
  })

  it('사용량 0·월초 — 퍼센트 0', () => {
    const v = computeUsageLimits(summary(0, 0, 0), 90, new Date(2026, 6, 1, 9))
    expect(v.week.pct).toBe(0)
    expect(v.month.pct).toBe(0)
  })

  it('한도 초과 — 월간 100% 클램프, 남은 예산 0 → 주간도 100%', () => {
    const v = computeUsageLimits(summary(0, 5, 120), 90, JUL_15_WED)
    expect(v.month.pct).toBe(1)
    // remainingLimit=0 → perDay=0 → weekBudget=wUsed → weekPct=1
    expect(v.week.pct).toBe(1)
  })

  it('한도 초과 + 이번주 사용 0 — 0분모 가드로 주간 0%', () => {
    const v = computeUsageLimits(summary(0, 0, 120), 90, JUL_15_WED)
    expect(v.week.pct).toBe(0)
  })
})
