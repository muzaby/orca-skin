import { describe, expect, it } from 'vitest'
import { normalizeUsageBreakdown, UsageBreakdownError, USAGE_BREAKDOWN_LIMITS } from './breakdown'
import type { UsageSnapshot } from './fetcher'
import type { UsageBreakdown } from '../../infra/db/types'

const base: UsageSnapshot = {
  providerKey: 'p',
  asOf: null,
  fetchedAt: 0,
  limitUsd: null,
  usedUsd: null,
  remainingUsd: null,
  raw: null
}
const normalize = (fields: unknown): UsageBreakdown =>
  normalizeUsageBreakdown({ ...base, ...(fields as object) })
const nil = {
  inputTokens: null,
  outputTokens: null,
  cacheCreationInputTokens: null,
  cacheReadInputTokens: null,
  costUsd: null
}

describe('원격 내역 정규화', () => {
  it.each([
    {},
    { daily: null, monthly: null },
    { daily: [], monthly: [] },
    { daily: [{ day: '2026-10-01' }] },
    { daily: [{ day: '2026-10-01', total: null, models: [] }] },
    { daily: [{ day: '2026-10-01', total: { inputTokens: null }, models: [{ model: 'm' }] }] }
  ])('미제공은 쓰기 0: %j', (fields) => {
    expect(normalize(fields)).toEqual({ totals: [], modelSets: [] })
  })
  it('제공된 0은 보존하고 미제공 수치는 NULL이다', () => {
    expect(
      normalize({
        daily: [
          { day: '2026-10-01', total: { costUsd: 0 }, models: [{ model: ' m ', inputTokens: 5 }] }
        ]
      })
    ).toEqual({
      totals: [{ kind: 'day', period: '2026-10-01', ...nil, costUsd: 0 }],
      modelSets: [
        { kind: 'day', period: '2026-10-01', models: [{ ...nil, model: 'm', inputTokens: 5 }] }
      ]
    })
  })
  it('월 total과 total 없는 월 모델 집합을 독립 정규화한다', () => {
    const r = normalize({
      monthly: [
        { month: '2026-10', total: { outputTokens: 5 }, models: [{ model: 'a', costUsd: 2 }] },
        { month: '2026-09', models: [{ model: 'b', costUsd: 3 }] }
      ]
    })
    expect(r.totals).toHaveLength(1)
    expect(r.modelSets).toHaveLength(2)
  })
  it.each([
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-00-01',
    '26-10-01',
    '2026-10-1',
    '2026-10-00'
  ])('실재하지 않는 day %s', (day) => {
    expect(() => normalize({ daily: [{ day, total: { costUsd: 1 } }] })).toThrow(
      UsageBreakdownError
    )
  })
  it('윤년과 0~99년을 Date 생성자 특례 없이 검사한다', () => {
    expect(() =>
      normalize({
        daily: [
          { day: '2024-02-29', total: { inputTokens: 0 } },
          { day: '0099-01-01', total: { costUsd: 0 } }
        ]
      })
    ).not.toThrow()
  })
  it.each(['2026-13', '2026-00', '2026-1', '26-10'])('잘못된 month %s', (month) => {
    expect(() => normalize({ monthly: [{ month, total: { costUsd: 1 } }] })).toThrow(
      UsageBreakdownError
    )
  })
  it.each([
    { daily: {} },
    { monthly: '2026-10' },
    { daily: [null] },
    { daily: [{ day: '2026-10-01', total: 3 }] },
    { daily: [{ day: '2026-10-01', models: {} }] },
    { daily: [{ day: '2026-10-01' }, { day: '2026-10-01' }] },
    { monthly: [{ month: '2026-10' }, { month: '2026-10' }] },
    { daily: [{ day: '2026-10-01', models: [{ model: 'a' }, { model: ' a ', costUsd: 1 }] }] },
    { daily: [{ day: '2026-10-01', models: [{ model: ' ', costUsd: 1 }] }] },
    { daily: [{ day: '2026-10-01', models: [{ model: 'x'.repeat(201), costUsd: 1 }] }] }
  ])('형식·중복 모델·기간 오류: %j', (fields) =>
    expect(() => normalize(fields)).toThrow(UsageBreakdownError)
  )
  it.each([-1, NaN, Infinity, -Infinity, '1', true])('잘못된 수치 %s', (costUsd) => {
    expect(() => normalize({ daily: [{ day: '2026-10-01', total: { costUsd } }] })).toThrow(
      UsageBreakdownError
    )
  })
  it.each([1.5, Number.MAX_SAFE_INTEGER + 1, -1])('비정수·안전범위 밖 토큰 %s', (inputTokens) => {
    expect(() =>
      normalize({ daily: [{ day: '2026-10-01', models: [{ model: 'a', inputTokens }] }] })
    ).toThrow(UsageBreakdownError)
  })
  const day = (i: number): string => {
    const d = new Date(2024, 0, 1 + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const month = (i: number): string =>
    `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
  it.each([USAGE_BREAKDOWN_LIMITS.daily, USAGE_BREAKDOWN_LIMITS.daily + 1])(
    'daily 상한 %s',
    (n) => {
      const f = (): UsageBreakdown =>
        normalize({ daily: Array.from({ length: n }, (_, i) => ({ day: day(i) })) })
      if (n === 400) expect(f).not.toThrow()
      else expect(f).toThrow(UsageBreakdownError)
    }
  )
  it.each([120, 121])('monthly 상한 %s', (n) => {
    const f = (): UsageBreakdown =>
      normalize({ monthly: Array.from({ length: n }, (_, i) => ({ month: month(i) })) })
    if (n === 120) expect(f).not.toThrow()
    else expect(f).toThrow(UsageBreakdownError)
  })
  it.each([500, 501])('기간 모델 상한 %s', (n) => {
    const f = (): UsageBreakdown =>
      normalize({
        daily: [
          {
            day: day(0),
            models: Array.from({ length: n }, (_, i) => ({ model: `m${i}`, costUsd: 1 }))
          }
        ]
      })
    if (n === 500) expect(f).not.toThrow()
    else expect(f).toThrow(UsageBreakdownError)
  })
  it.each([10000, 10001])('저장 행 합 상한 %s', (n) => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      day: day(i),
      models: Array.from({ length: 500 }, (_, j) => ({ model: `m${j}`, inputTokens: 1 }))
    }))
    const f = (): UsageBreakdown =>
      normalize({
        daily: [...entries, ...(n > 10000 ? [{ day: day(20), total: { costUsd: 1 } }] : [])]
      })
    if (n === 10000) expect(f).not.toThrow()
    else expect(f).toThrow(UsageBreakdownError)
  })
})
