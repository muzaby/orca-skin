import { describe, expect, it } from 'vitest'
import type { CostPeriodSummary, CostSummary } from '../ipc'
import { computeUsageLimits, computeUsageLimitsFrom } from './limits'

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

  it('출처를 지정하지 않으면 두 기간 모두 local 이다 (0186)', () => {
    const v = computeUsageLimits(summary(0, 8, 30), 90, JUL_15_WED)
    expect(v.week.source).toBe('local')
    expect(v.month.source).toBe('local')
  })
})

// 0186 — provider 월간은 원격 기준선 + 로컬 증분으로 합성될 수 있어 CostSummary 한 곳에서
// 나오지 않는다. 합성 판정은 usage-compose 가 하고, 여기서는 값을 받아 예산·퍼센트만 파생한다.
describe('computeUsageLimitsFrom', () => {
  it('summary 경유와 같은 결과를 낸다', () => {
    expect(computeUsageLimitsFrom({ week: 8, month: 30 }, 90, JUL_15_WED)).toEqual(
      computeUsageLimits(summary(0, 8, 30), 90, JUL_15_WED)
    )
  })

  it('월간만 remote-baseline 로 표기하고 주간은 local 을 유지한다', () => {
    const v = computeUsageLimitsFrom({ week: 8, month: 319 }, 500, JUL_15_WED, {
      week: 'local',
      month: 'remote-baseline'
    })
    expect(v.week.source).toBe('local')
    expect(v.month.source).toBe('remote-baseline')
    expect(v.month.used).toBe(319)
    expect(v.month.pct).toBeCloseTo(319 / 500, 5)
  })

  it('무제한이어도 출처 표기는 보존한다', () => {
    const v = computeUsageLimitsFrom({ week: 8, month: 319 }, null, JUL_15_WED, {
      week: 'local',
      month: 'remote-baseline'
    })
    expect(v.month).toMatchObject({ budget: null, unlimited: true, source: 'remote-baseline' })
  })
})
