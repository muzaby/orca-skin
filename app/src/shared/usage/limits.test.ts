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

  it('computeProviderUsageLimits — external·fresh 면 월=권위 M, 주/일을 M/로컬월 배 스케일(0111)', () => {
    const entry = (effectiveLimit: ProviderUsageEntry['effectiveLimit']): ProviderUsageEntry => ({
      providerKey: 'claude-anthropic',
      summary: summary(0, 8, 30),
      limitUsd: 90,
      effectiveLimit
    })
    const external = computeProviderUsageLimits(
      entry({ source: 'external', usedUsd: 45, limitUsd: 90, remainingUsd: 45 }),
      JUL_15_WED
    )
    // 로컬월=30, 외부월=45 → scale=1.5 → 주간 used = 8×1.5 = 12.
    expect(external.month.used).toBe(45)
    expect(external.month.pct).toBeCloseTo(45 / 90, 5)
    expect(external.week.used).toBeCloseTo(12, 5)
    expect(external.week.used).toBeLessThanOrEqual(external.month.used) // 정합 보존

    const local = computeProviderUsageLimits(
      entry({ source: 'local', usedUsd: 30, limitUsd: 90, remainingUsd: 60 }),
      JUL_15_WED
    )
    expect(local.month.used).toBe(30)
    expect(local.week.used).toBe(8) // 로컬 경로는 스케일 없음
    expect(local).toEqual(computeUsageLimits(summary(0, 8, 30), 90, JUL_15_WED))
  })

  it('computeProviderUsageLimits — external·fresh 로컬월≈0 폴백: 외부 사용을 경과일 균등 분배', () => {
    const entry: ProviderUsageEntry = {
      providerKey: 'claude-anthropic',
      summary: summary(0, 0, 0),
      limitUsd: 90,
      effectiveLimit: { source: 'external', usedUsd: 30, limitUsd: 90, remainingUsd: 60 }
    }
    // 7/15: 경과일=15, perDay=30/15=2; 이번 주 경과일(7/13~7/15)=3 → 주간=6, 일간=2.
    const v = computeProviderUsageLimits(entry, JUL_15_WED)
    expect(v.month.used).toBe(30)
    expect(v.week.used).toBeCloseTo(6, 5)
    expect(v.week.used).toBeLessThanOrEqual(v.month.used)
  })

  it('computeProviderUsageLimits — external·stale: 월=max(baseline,로컬월), 주/일=로컬 원값(0111)', () => {
    const mk = (localMonth: number, weekUsed: number): ProviderUsageEntry => ({
      providerKey: 'claude-anthropic',
      summary: summary(0, weekUsed, localMonth),
      limitUsd: 90,
      effectiveLimit: {
        source: 'external',
        usedUsd: 45,
        limitUsd: 90,
        remainingUsd: 45,
        stale: true
      }
    })
    // baseline(45) > 로컬월(30) → 월=45(floor 유지), 주간은 스케일 없이 로컬 8 그대로.
    const held = computeProviderUsageLimits(mk(30, 8), JUL_15_WED)
    expect(held.month.used).toBe(45)
    expect(held.week.used).toBe(8)
    // 로컬월(60) > baseline(45) → 로컬 채택.
    const grown = computeProviderUsageLimits(mk(60, 8), JUL_15_WED)
    expect(grown.month.used).toBe(60)
    expect(grown.week.used).toBe(8)
  })
})
