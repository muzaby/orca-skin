import { describe, expect, it } from 'vitest'
import type { CostSummary, CostPeriodSummary } from '../../../shared/ipc'
import { computeUsageLimits } from '../../../shared/usage/limits'
import { composeProviderUsage } from './usage-compose'
import type { UsageSnapshot } from './fetcher'

// 로컬타임 기준으로 월 중순 수요일 — 이번 주가 달을 걸치지 않아 경계 주 보정이 끼어들지 않는다.
const NOW = new Date(2026, 7, 12, 10, 0, 0)
const IN_MONTH = new Date(2026, 7, 10, 0, 0, 0).getTime()
const LAST_MONTH = new Date(2026, 6, 25, 0, 0, 0).getTime()

function period(totalCostUsd: number): CostPeriodSummary {
  return {
    totalCostUsd,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0
  }
}

function summary(weekUsd: number, monthUsd: number): CostSummary {
  return {
    day: period(0),
    week: period(weekUsd),
    month: period(monthUsd),
    updatedAt: NOW.getTime()
  }
}

function snapshot(over: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    providerKey: 'claude-gateway',
    asOf: IN_MONTH,
    fetchedAt: NOW.getTime(),
    limitUsd: 500,
    usedUsd: 312,
    remainingUsd: 188,
    baselineUsable: true,
    raw: {},
    ...over
  }
}

const local = { summary: summary(12, 40), monthDeltaCostUsd: 7 }

describe('composeProviderUsage — 기준선 합성', () => {
  it('기준선에 증분을 얹는다', () => {
    const view = composeProviderUsage(local, snapshot(), 300, NOW)

    // 312(계정 기준선) + 7(asOf 이후 이 PC 증분). 로컬 월 집계 40 은 쓰지 않는다.
    expect(view.month.used).toBe(319)
    expect(view.month.source).toBe('remote-baseline')
    // 한도도 원격이 정본 — 사용자 설정 300 이 아니라 500.
    expect(view.month.budget).toBe(500)
  })

  it('baselineUsable 미지정은 local 로 접힌다', () => {
    const view = composeProviderUsage(local, snapshot({ baselineUsable: undefined }), 300, NOW)

    expect(view.month.used).toBe(40)
    expect(view.month.source).toBe('local')
  })

  it('baselineUsable false 도 local 로 접힌다', () => {
    const view = composeProviderUsage(local, snapshot({ baselineUsable: false }), 300, NOW)

    expect(view.month.used).toBe(40)
    expect(view.month.source).toBe('local')
  })

  it('asOf 나 usedUsd 가 없으면 기준선을 쓰지 않는다', () => {
    expect(composeProviderUsage(local, snapshot({ asOf: null }), 300, NOW).month.source).toBe(
      'local'
    )
    expect(composeProviderUsage(local, snapshot({ usedUsd: null }), 300, NOW).month.source).toBe(
      'local'
    )
  })

  it('월 경계 밖 기준선은 폐기한다', () => {
    const view = composeProviderUsage(local, snapshot({ asOf: LAST_MONTH }), 300, NOW)

    // 지난달 기준선 위에 이번 달 증분을 얹으면 지난달 사용액이 섞인다.
    expect(view.month.used).toBe(40)
    expect(view.month.source).toBe('local')
  })

  it('기준선 없이 한도만 원격을 쓴다', () => {
    const view = composeProviderUsage(
      local,
      snapshot({ baselineUsable: false, limitUsd: 500 }),
      300,
      NOW
    )

    expect(view.month.source).toBe('local')
    expect(view.month.used).toBe(40)
    expect(view.month.budget).toBe(500)
  })

  it('원격이 한도를 주지 않으면 사용자 설정 한도로 폴백한다', () => {
    const view = composeProviderUsage(local, snapshot({ limitUsd: null }), 300, NOW)

    expect(view.month.budget).toBe(300)
  })

  it('주간은 언제나 로컬이다', () => {
    const remote = composeProviderUsage(local, snapshot(), 300, NOW)
    const localOnly = composeProviderUsage(local, null, 300, NOW)

    expect(remote.week.used).toBe(12)
    expect(remote.week.source).toBe('local')
    expect(localOnly.week.used).toBe(12)
    expect(localOnly.week.source).toBe('local')
  })

  it('스냅샷이 없으면 로컬 집계와 사용자 한도로 파생한다', () => {
    const view = composeProviderUsage(local, null, 300, NOW)

    expect(view.month.used).toBe(40)
    expect(view.month.budget).toBe(300)
    expect(view.month.source).toBe('local')
  })

  it('한도가 없으면 무제한으로 표시한다', () => {
    const view = composeProviderUsage(local, snapshot({ limitUsd: null }), null, NOW)

    expect(view.month.unlimited).toBe(true)
    expect(view.month.budget).toBeNull()
    expect(view.week.unlimited).toBe(true)
  })

  it('원격 수치가 내려가도 그대로 반영한다 (correction 허용)', () => {
    const before = composeProviderUsage(local, snapshot({ usedUsd: 312 }), 300, NOW)
    const after = composeProviderUsage(local, snapshot({ usedUsd: 280 }), 300, NOW)

    expect(before.month.used).toBe(319)
    expect(after.month.used).toBe(287)
  })
})

describe('전역 사용량 (computeUsageLimits 직결)', () => {
  it('전역은 원격을 보지 않는다', () => {
    const view = computeUsageLimits(summary(12, 40), 300, NOW)

    expect(view.week.source).toBe('local')
    expect(view.month.source).toBe('local')
    expect(view.month.used).toBe(40)
    expect(view.month.budget).toBe(300)
  })

  it('한도 미설정이면 무제한이다', () => {
    const view = computeUsageLimits(summary(12, 40), null, NOW)

    expect(view.month.unlimited).toBe(true)
    expect(view.month.used).toBe(40)
  })
})
