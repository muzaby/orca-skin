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

const local = { summary: summary(12, 40) }

describe('composeProviderUsage — 월 원격값 합성', () => {
  it('SDK 증분 없이 원격 월 값만 쓴다', () => {
    const view = composeProviderUsage(local, snapshot(), 300, NOW)

    // 원격 월 값 312만 쓴다. 로컬 월 집계 40은 쓰지 않는다.
    expect(view.month.used).toBe(312)
    expect(view.month.source).toBe('remote')
    // 한도도 원격이 정본 — 사용자 설정 300 이 아니라 500.
    expect(view.month.budget).toBe(500)
  })

  it('baselineUsable 미지정에도 원격 월 값을 쓴다', () => {
    const view = composeProviderUsage(local, snapshot({ baselineUsable: undefined }), 300, NOW)

    expect(view.month.used).toBe(312)
    expect(view.month.source).toBe('remote')
  })

  it('baselineUsable false 에도 원격 월 값을 쓴다', () => {
    const view = composeProviderUsage(local, snapshot({ baselineUsable: false }), 300, NOW)

    expect(view.month.used).toBe(312)
    expect(view.month.source).toBe('remote')
  })

  it('asOf 없으면 수신 월로 판정하고 usedUsd 없으면 로컬이다', () => {
    expect(composeProviderUsage(local, snapshot({ asOf: null }), 300, NOW).month.source).toBe(
      'remote'
    )
    expect(composeProviderUsage(local, snapshot({ usedUsd: null }), 300, NOW).month.source).toBe(
      'local'
    )
  })

  it('월 경계 밖 월 원격값은 폐기한다', () => {
    const view = composeProviderUsage(local, snapshot({ asOf: LAST_MONTH }), 300, NOW)

    // 지난달 usedUsd는 이번 달 사용액으로 쓰지 않는다.
    expect(view.month.used).toBe(40)
    expect(view.month.source).toBe('local')
  })

  it('원격 사용액 없이 한도만 원격을 쓴다', () => {
    const view = composeProviderUsage(local, snapshot({ usedUsd: null, limitUsd: 500 }), 300, NOW)

    expect(view.month.source).toBe('local')
    expect(view.month.used).toBe(40)
    expect(view.month.budget).toBe(500)
  })

  it('원격이 한도를 주지 않으면 사용자 설정 한도로 폴백한다', () => {
    const view = composeProviderUsage(local, snapshot({ limitUsd: null }), 300, NOW)

    expect(view.month.budget).toBe(300)
  })

  it('원격 날짜 내역이 없으면 주간은 로컬이다', () => {
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

    expect(before.month.used).toBe(312)
    expect(after.month.used).toBe(280)
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

describe('0251 provider 기간 우선순위·엄격 원격 칸', () => {
  const dailyLocal = {
    summary: summary(100, 200),
    dayCostUsd: new Map([
      ['2026-08-01', 11],
      ['2026-08-10', 22],
      ['2026-08-11', 33],
      ['2026-08-12', 44]
    ])
  }
  it.each([
    [{ costUsd: 50 }, 312, 50],
    [{ costUsd: null }, 312, 312],
    [{ costUsd: null }, null, 0],
    [null, 312, 312]
  ] as const)('월 칸 monthly 비용·usedUsd·0 순서 %j %s', (month, usedUsd, used) => {
    const v = composeProviderUsage(dailyLocal, snapshot({ usedUsd }), 300, NOW, {
      month,
      days: new Map([['2026-08-12', 7]])
    })
    expect(v.month).toMatchObject({ used, source: 'remote' })
    expect(v.week.used).toBe(22 + 33 + 7)
  })
  it('월 날짜 칸이 있으면 원격 NULL은 0이고 칸 없는 날만 SDK로 합친다', () => {
    const v = composeProviderUsage(dailyLocal, snapshot({ usedUsd: null }), 300, NOW, {
      month: null,
      days: new Map([
        ['2026-08-10', null],
        ['2026-08-12', 7],
        ['2026-08-13', 99]
      ])
    })
    expect(v.month).toMatchObject({ used: 11 + 33 + 7, source: 'remote-daily' })
    expect(v.week).toMatchObject({ used: 33 + 7, source: 'remote-daily' })
  })
  it('원격 비용만 보유한 이전 주 날짜는 월에만 쓰이고 미래 원격은 둘 다 무시한다', () => {
    const v = composeProviderUsage(dailyLocal, snapshot({ usedUsd: null }), 300, NOW, {
      month: null,
      days: new Map([
        ['2026-08-01', 7],
        ['2026-08-13', 99]
      ])
    })
    expect(v.month.used).toBe(7 + 22 + 33 + 44)
    expect(v.week).toMatchObject({ used: 100, source: 'local' })
  })
  it('월 경계 주는 지난달 원격 날짜를 제외한다', () => {
    const now = new Date(2026, 9, 1, 12)
    const local = {
      summary: summary(2, 2),
      dayCostUsd: new Map([
        ['2026-09-30', 99],
        ['2026-10-01', 2]
      ])
    }
    const v = composeProviderUsage(local, null, 100, now, {
      month: null,
      days: new Map([
        ['2026-09-30', 90],
        ['2026-10-01', 7]
      ])
    })
    expect(v.week).toMatchObject({ used: 7, source: 'remote-daily' })
    expect(v.month.used).toBe(7)
  })
  it('asOf 없음은 fetchedAt 이번 달/지난달로 판정하며 미래 달 asOf도 제외한다', () => {
    expect(composeProviderUsage(local, snapshot({ asOf: null }), 300, NOW).month.used).toBe(312)
    expect(
      composeProviderUsage(local, snapshot({ asOf: null, fetchedAt: LAST_MONTH }), 300, NOW).month
        .source
    ).toBe('local')
    expect(
      composeProviderUsage(local, snapshot({ asOf: new Date(2026, 8, 1).getTime() }), 300, NOW)
        .month.source
    ).toBe('local')
  })
  it.each([true, false, undefined])(
    '호환 필드 %s와 무관하게 usedUsd를 쓰며 주에는 월 칸을 쓰지 않는다',
    (baselineUsable) => {
      const v = composeProviderUsage(local, snapshot({ baselineUsable }), 300, NOW, {
        month: { costUsd: 10 },
        days: new Map()
      })
      expect(v.month).toMatchObject({ used: 10, source: 'remote' })
      expect(v.week).toMatchObject({ used: 12, source: 'local' })
    }
  )
  it.each([true, false])(
    '기간 내역 유무 %s와 무관하게 원격 한도 ?? 사용자 한도다',
    (remotePeriods) => {
      for (const limitUsd of [500, null]) {
        const v = composeProviderUsage(
          local,
          snapshot({ limitUsd }),
          300,
          NOW,
          remotePeriods ? { month: { costUsd: 7 }, days: new Map() } : undefined
        )
        expect(v.month.budget).toBe(limitUsd ?? 300)
        expect(v.budgetSource).toBe(limitUsd != null ? 'remote' : 'configured')
        expect(v.configuredLimitUsd).toBe(300)
      }
    }
  )
})
