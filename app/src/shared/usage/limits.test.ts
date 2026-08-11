import { describe, expect, it } from 'vitest'
import type { CostPeriodSummary, CostSummary, ProviderUsageEntry } from '../ipc'
import { computeProviderUsageLimits, computeUsageLimits } from './limits'

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
  it('워크드 예시 — L=$90, 7/15(수), 월사용 $30, 주사용 $8 → 주간≈39%·월간≈33% (고정 일할)', () => {
    const v = computeUsageLimits(summary(0, 8, 30), 90, JUL_15_WED)
    // daysInMonth=31, 7/13~7/19 주는 전부 7월 → weekDaysInMonth=7, weekBudget=90×7/31≈20.32
    expect(v.month.pct).toBeCloseTo(30 / 90, 5)
    expect(v.week.budget).toBeCloseTo((90 * 7) / 31, 5)
    expect(v.week.pct).toBeCloseTo(8 / ((90 * 7) / 31), 5)
    expect(v.week.pct).toBeGreaterThan(0.39)
    expect(v.week.pct).toBeLessThan(0.4)
    expect(v.month.budget).toBe(90)
    expect(v.month.unlimited).toBe(false)
    // 재설정 시각은 데이터(epoch)로만 노출 — 문장화는 renderer i18n(0100).
    expect(v.month).toMatchObject({ period: 'month', resetAt: new Date(2026, 7, 1).getTime() })
    expect(v.week).toMatchObject({ period: 'week', resetAt: new Date(2026, 6, 20).getTime() })
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

  it('한도 초과 — 월간 100% 클램프, 주간은 고정 버짓 대비 실지출로 독립 계산', () => {
    const v = computeUsageLimits(summary(0, 5, 120), 90, JUL_15_WED)
    expect(v.month.pct).toBe(1)
    // 주간 버짓은 월 초과와 무관한 고정 일할값(90×7/31) → weekPct=5/버짓, 100% 아님.
    expect(v.week.pct).toBeCloseTo(5 / ((90 * 7) / 31), 5)
    expect(v.week.pct).toBeLessThan(0.3)
  })

  it('한도 초과 + 이번주 사용 0 — 분자 0이라 주간 0%', () => {
    const v = computeUsageLimits(summary(0, 0, 120), 90, JUL_15_WED)
    expect(v.week.pct).toBe(0)
  })

  it('경계 주 — 버짓은 이달에 속한 일수만 반영(7/30=5일, 8/1=2일)', () => {
    const jul = computeUsageLimits(summary(0, 0, 0), 90, new Date(2026, 6, 30, 12)) // 7/27~7/31 = 5일
    expect(jul.week.budget).toBeCloseTo((90 * 5) / 31, 5)
    const aug = computeUsageLimits(summary(0, 0, 0), 90, new Date(2026, 7, 1, 12)) // 8/1~8/2 = 2일
    expect(aug.week.budget).toBeCloseTo((90 * 2) / 31, 5)
  })

  it('computeProviderUsageLimits — 로컬 summary·월 한도로 파생한다 (0183 r2)', () => {
    const entry: ProviderUsageEntry = {
      providerKey: 'claude-anthropic',
      summary: summary(0, 8, 30),
      limitUsd: 90
    }
    // 외부 리포트 경로가 사라져 파생은 computeUsageLimits 와 완전히 같다.
    expect(computeProviderUsageLimits(entry, JUL_15_WED)).toEqual(
      computeUsageLimits(summary(0, 8, 30), 90, JUL_15_WED)
    )
  })

  it('computeProviderUsageLimits — 한도 미설정이면 무제한 뷰가 된다', () => {
    const entry: ProviderUsageEntry = {
      providerKey: 'claude-anthropic',
      summary: summary(0, 8, 30),
      limitUsd: null
    }
    const v = computeProviderUsageLimits(entry, JUL_15_WED)
    expect(v.month).toMatchObject({ used: 30, budget: null, unlimited: true })
    expect(v.week).toMatchObject({ used: 8, budget: null, unlimited: true })
  })
})
