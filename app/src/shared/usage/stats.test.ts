import { describe, expect, it } from 'vitest'
import type { UsageStatsDay } from '../ipc'
import {
  MAX_FILLED_DAYS,
  aggregateWeekly,
  fillDailySeries,
  localDayKey,
  rangeSince,
  totalTokens
} from './stats'

// 로컬 타임존 기준 임의 시각 — 2026-07-16(목) 14:30.
const NOW = new Date(2026, 6, 16, 14, 30).getTime()

function day(key: string, tokens = 0, cost = 0): UsageStatsDay {
  return {
    day: key,
    inputTokens: tokens,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalCostUsd: cost
  }
}

describe('totalTokens', () => {
  it('4종 토큰을 전부 합산한다', () => {
    expect(
      totalTokens({
        inputTokens: 1,
        outputTokens: 2,
        cacheCreationInputTokens: 3,
        cacheReadInputTokens: 4
      })
    ).toBe(10)
  })
})

describe('rangeSince', () => {
  it('7d = 오늘 포함 7일(로컬 자정)', () => {
    expect(rangeSince('7d', NOW)).toBe(new Date(2026, 6, 10).getTime())
  })

  it('30d = 오늘 포함 30일(로컬 자정)', () => {
    expect(rangeSince('30d', NOW)).toBe(new Date(2026, 5, 17).getTime())
  })

  it('all = 0', () => {
    expect(rangeSince('all', NOW)).toBe(0)
  })

  it('월 경계를 Date 롤오버로 넘는다', () => {
    // 7월 3일 − 6일 = 6월 27일
    expect(rangeSince('7d', new Date(2026, 6, 3, 9).getTime())).toBe(
      new Date(2026, 5, 27).getTime()
    )
  })
})

describe('localDayKey', () => {
  it('로컬 YYYY-MM-DD (zero-pad)', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
    expect(localDayKey(new Date(2026, 11, 31).getTime())).toBe('2026-12-31')
  })
})

describe('fillDailySeries', () => {
  it('7d — since 부터 오늘까지 정확히 7개 연속, 빈 날은 0', () => {
    const since = rangeSince('7d', NOW)
    const filled = fillDailySeries([day('2026-07-12', 100)], since, NOW)
    expect(filled).toHaveLength(7)
    expect(filled[0].day).toBe('2026-07-10')
    expect(filled[6].day).toBe('2026-07-16')
    expect(filled.find((r) => r.day === '2026-07-12')?.inputTokens).toBe(100)
    expect(filled.filter((r) => r.inputTokens === 0)).toHaveLength(6)
  })

  it('30d — 정확히 30개', () => {
    const filled = fillDailySeries([], rangeSince('30d', NOW), NOW)
    expect(filled).toHaveLength(30)
    expect(filled[0].day).toBe('2026-06-17')
  })

  it('all(since=null) — 가장 이른 행부터 오늘까지', () => {
    const filled = fillDailySeries([day('2026-07-01', 5), day('2026-07-10', 7)], null, NOW)
    expect(filled).toHaveLength(16)
    expect(filled[0].day).toBe('2026-07-01')
    expect(filled[9].inputTokens).toBe(7)
  })

  it('all — 빈 입력은 빈 배열', () => {
    expect(fillDailySeries([], null, NOW)).toEqual([])
  })

  it('오늘 이후 키(시계 스큐)는 버린다', () => {
    const filled = fillDailySeries([day('2027-01-01', 9)], rangeSince('7d', NOW), NOW)
    expect(filled).toHaveLength(7)
    expect(filled.every((r) => r.inputTokens === 0)).toBe(true)
  })

  it('전체 범위가 캡을 넘으면 최근 MAX_FILLED_DAYS 로 자른다', () => {
    const filled = fillDailySeries([day('2020-01-01', 1)], null, NOW)
    expect(filled).toHaveLength(MAX_FILLED_DAYS)
    expect(filled[filled.length - 1].day).toBe('2026-07-16')
  })
})

describe('aggregateWeekly', () => {
  it('월요일 시작 주 버킷으로 합산한다', () => {
    // 2026-07-13(월) ~ 2026-07-16(목) 는 같은 주, 2026-07-12(일) 는 전 주(7-06 월요일).
    const weekly = aggregateWeekly([
      day('2026-07-12', 10, 1),
      day('2026-07-13', 20, 2),
      day('2026-07-16', 30, 3)
    ])
    expect(weekly).toHaveLength(2)
    expect(weekly[0]).toMatchObject({ day: '2026-07-06', inputTokens: 10, totalCostUsd: 1 })
    expect(weekly[1]).toMatchObject({ day: '2026-07-13', inputTokens: 50, totalCostUsd: 5 })
  })
})
