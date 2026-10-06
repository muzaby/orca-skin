import { describe, expect, it } from 'vitest'
import { composeUsageStats } from './usage-stats-compose'
import type {
  ProviderDailyUsageRow,
  ProviderDayModelUsageRow,
  ProviderUsagePeriodRow,
  ProviderUsagePeriodModelRow
} from '../../infra/db/types'
const window = { from: '2026-10-01', to: '2026-10-06' }
const local = (p: string | null, day: string, cost = 2): ProviderDailyUsageRow => ({
  provider_key: p,
  day,
  input_tokens: 100,
  output_tokens: 20,
  cache_creation_input_tokens: 10,
  cache_read_input_tokens: 5,
  total_cost_usd: cost
})
const model = (p: string | null, day: string, m: string): ProviderDayModelUsageRow => ({
  provider_key: p,
  day,
  model: m,
  input_tokens: 100,
  output_tokens: 20,
  cache_creation_input_tokens: 10,
  cache_read_input_tokens: 5,
  cost_usd: 2
})
const remote = (p: string, day: string): ProviderUsagePeriodRow => ({
  provider_key: p,
  period_kind: 'day',
  period: day,
  input_tokens: null,
  output_tokens: null,
  cache_creation_input_tokens: null,
  cache_read_input_tokens: null,
  cost_usd: 7,
  fetched_at: 1,
  updated_at: 1
})
const remoteModel = (p: string, day: string, m: string): ProviderUsagePeriodModelRow => ({
  ...remote(p, day),
  model: m,
  cost_usd: null,
  input_tokens: 3
})
describe('사용량 탭 원격 칸 합성', () => {
  it('원격 비용만 제공하면 같은 칸 SDK 토큰 4종은 0이며 provider 없는 행은 보존한다', () => {
    const result = composeUsageStats(
      [local('p', '2026-10-01'), local(null, '2026-10-01', 1), local('q', '2026-10-02')],
      [],
      [remote('p', '2026-10-01')],
      [],
      window
    )
    expect(result.days).toEqual([
      {
        day: '2026-10-01',
        inputTokens: 100,
        outputTokens: 20,
        cacheCreationInputTokens: 10,
        cacheReadInputTokens: 5,
        totalCostUsd: 8
      },
      {
        day: '2026-10-02',
        inputTokens: 100,
        outputTokens: 20,
        cacheCreationInputTokens: 10,
        cacheReadInputTokens: 5,
        totalCostUsd: 2
      }
    ])
  })
  it('원격 모델 집합 전체를 쓰고 같은 모델 SDK 비용과 SDK 전용 모델을 버린다', () => {
    const r = composeUsageStats(
      [],
      [model('p', '2026-10-01', 'a'), model('p', '2026-10-01', 'sdk-only')],
      [],
      [remoteModel('p', '2026-10-01', 'a')],
      window
    )
    expect(r.models).toEqual([
      {
        model: 'a',
        inputTokens: 3,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        costUsd: 0
      }
    ])
  })
  it('다른 provider·날짜 모델은 합산하고 토큰 내림차순·이름 오름차순으로 정렬한다', () => {
    const r = composeUsageStats(
      [],
      [
        model(null, '2026-10-03', 'z'),
        model('q', '2026-10-03', 'b'),
        model('q', '2026-10-02', 'b')
      ],
      [],
      [remoteModel('p', '2026-10-01', 'a'), remoteModel('p', '2026-10-01', 'c')],
      window
    )
    expect(r.models.map((m) => m.model)).toEqual(['b', 'z', 'a', 'c'])
    expect(r.models[0].inputTokens).toBe(200)
  })
  it('범위 전·미래·월 원격 행은 제외하고 희소 날짜 오름차순을 유지한다', () => {
    const r = composeUsageStats(
      [local('p', '2026-10-03'), local('p', '2026-10-01'), local('p', '2026-10-07')],
      [],
      [
        remote('p', '2026-09-30'),
        remote('p', '2026-10-07'),
        { ...remote('p', '2026-10'), period_kind: 'month' }
      ],
      [remoteModel('p', '2026-09-30', 'old'), remoteModel('p', '2026-10-07', 'future')],
      window
    )
    expect(r.days.map((d) => d.day)).toEqual(['2026-10-01', '2026-10-03'])
    expect(r.models).toEqual([])
  })
  it('원격만 있는 날·모델도 빈 상태가 아니고 total과 모델 집합은 서로 독립이다', () => {
    const r = composeUsageStats(
      [],
      [],
      [remote('p', '2026-10-02')],
      [remoteModel('p', '2026-10-04', 'a')],
      { to: window.to }
    )
    expect(r.days).toHaveLength(1)
    expect(r.models).toHaveLength(1)
  })
})
