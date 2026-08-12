// 0186 — tracker 의 정본 조립·delta 방출·원격 갱신 계약. DB 는 fake 로 대체해 순수 단위로 둔다
// (실제 왕복은 `infra/db/queries.test.ts` 가 본다).

import { describe, expect, it, vi } from 'vitest'
import type { DbQueries } from '../../infra/db'
import type { ProviderUsageReportRow } from '../../infra/db/types'
import type { UsageDelta } from '../../../shared/usage/limits'
import { UsageTracker } from './tracker'
import type { UsageFetcher, UsageSnapshot } from './fetcher'

const NOW = new Date(2026, 7, 12, 10, 0, 0).getTime()
const IN_MONTH = new Date(2026, 7, 10, 0, 0, 0).getTime()

function sums(totalCostUsd: number): Record<string, number> {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    total_cost_usd: totalCostUsd
  }
}

interface FakeDbOptions {
  report?: ProviderUsageReportRow
  limit?: number | null
  monthDeltaCostUsd?: number
}

function fakeDb(opts: FakeDbOptions = {}): {
  db: DbQueries
  insertTurnUsage: ReturnType<typeof vi.fn>
  insertTurnModelUsage: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  sumForProvider: ReturnType<typeof vi.fn>
} {
  const insertTurnUsage = vi.fn()
  const insertTurnModelUsage = vi.fn()
  const upsert = vi.fn()
  const sumForProvider = vi.fn().mockReturnValue({
    day: sums(1),
    week: sums(12),
    month: sums(40),
    monthDeltaCostUsd: opts.monthDeltaCostUsd ?? 7
  })
  const db = {
    insertTurnUsage,
    insertTurnModelUsage,
    upsertProviderUsageReport: upsert,
    getProviderUsageReport: vi.fn().mockReturnValue(opts.report),
    getProviderLimit: vi.fn().mockReturnValue(opts.limit ?? null),
    sumUsageByBoundaries: vi
      .fn()
      .mockReturnValue({ day: sums(1), week: sums(12), month: sums(40) }),
    sumUsageByBoundariesForProvider: sumForProvider
  } as unknown as DbQueries
  return { db, insertTurnUsage, insertTurnModelUsage, upsert, sumForProvider }
}

function reportRow(over: Partial<ProviderUsageReportRow> = {}): ProviderUsageReportRow {
  return {
    provider_key: 'claude-gateway',
    report_json: JSON.stringify({ baselineUsable: true, raw: {} }),
    fetched_at: NOW,
    as_of: IN_MONTH,
    quota_limit_usd: 500,
    quota_used_usd: 312,
    quota_remaining_usd: 188,
    updated_at: NOW,
    ...over
  }
}

function snapshot(over: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    providerKey: 'claude-gateway',
    asOf: IN_MONTH,
    fetchedAt: NOW,
    limitUsd: 500,
    usedUsd: 312,
    remainingUsd: 188,
    baselineUsable: true,
    raw: { any: 1 },
    ...over
  }
}

describe('UsageTracker delta 방출', () => {
  it('providerKey 가 있으면 global + provider 두 건을 낸다', () => {
    const { db } = fakeDb()
    const seen: UsageDelta[] = []
    const t = new UsageTracker(db, (d) => seen.push(d), { spendingLimitUsd: () => 300 })

    t.recordAndBroadcast('claude-gateway', NOW)

    expect(seen.map((d) => d.scope)).toEqual(['global', 'provider'])
    expect(seen[1]).toMatchObject({ scope: 'provider', providerKey: 'claude-gateway' })
  })

  it('providerKey 가 없으면 global 한 건만 낸다', () => {
    const { db } = fakeDb()
    const seen: UsageDelta[] = []
    const t = new UsageTracker(db, (d) => seen.push(d), { spendingLimitUsd: () => 300 })

    t.recordAndBroadcast(null, NOW)

    expect(seen.map((d) => d.scope)).toEqual(['global'])
  })

  // 경계(자정)는 `recordAndBroadcast()` 로 대체할 수 없다 — 전자는 renderer 가 캐시한 provider
  // 뷰까지 무효화해야 하는데 `scope:'global'` 로는 그 신호를 실을 수 없다(PR 329 리뷰 P0).
  it('경계 갱신은 boundary scope 한 건을 낸다', () => {
    const { db } = fakeDb()
    const seen: UsageDelta[] = []
    const t = new UsageTracker(db, (d) => seen.push(d), { spendingLimitUsd: () => 300 })

    t.refreshBoundary(NOW)

    expect(seen.map((d) => d.scope)).toEqual(['boundary'])
    // 전역 값은 함께 실어 보낸다 — 무효화만 하고 새 전역을 안 주면 도넛이 한 틱 비어 보인다.
    expect(seen[0]?.value.month.budget).toBe(300)
    expect(seen[0]?.value.month.used).toBe(40)
  })

  // 자정마다 전 provider 를 재집계하지 않는다(affected-provider 성능 계약 유지) — 무효화만 하고
  // 다시 채우는 것은 화면이 실제로 필요로 할 때다.
  it('경계 갱신은 provider 별 재집계를 하지 않는다', () => {
    const { db, sumForProvider } = fakeDb()
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    t.refreshBoundary(NOW)

    expect(sumForProvider).not.toHaveBeenCalled()
  })

  it('전역 뷰는 spendingLimitUsd 를 예산으로 쓴다', () => {
    const { db } = fakeDb()
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    const view = t.getGlobalUsage(NOW)

    expect(view.month.budget).toBe(300)
    expect(view.month.used).toBe(40)
    expect(view.month.source).toBe('local')
  })
})

describe('UsageTracker provider 정본', () => {
  it('기준선이 있으면 원격 값 위에 로컬 증분을 얹는다', () => {
    const { db } = fakeDb({ report: reportRow(), limit: 90 })
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    const view = t.getProviderUsage('claude-gateway', NOW)

    expect(view.month.used).toBe(319) // 312 + 7
    expect(view.month.source).toBe('remote-baseline')
    expect(view.month.budget).toBe(500) // 원격 한도가 사용자 한도 90 을 이긴다
  })

  it('봉투가 baselineUsable 을 담지 않으면 기준선을 쓰지 않는다', () => {
    const { db } = fakeDb({
      report: reportRow({ report_json: JSON.stringify({ raw: {} }) }),
      limit: 90
    })
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    const view = t.getProviderUsage('claude-gateway', NOW)

    expect(view.month.source).toBe('local')
    expect(view.month.used).toBe(40)
    // 기준선을 못 써도 한도는 원격이 정본이다.
    expect(view.month.budget).toBe(500)
  })

  it('봉투 파싱이 실패하면 기준선을 쓰지 않는다 (fail-closed)', () => {
    const { db } = fakeDb({ report: reportRow({ report_json: 'not json' }), limit: 90 })
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    expect(t.getProviderUsage('claude-gateway', NOW).month.source).toBe('local')
  })

  it('스냅샷이 없으면 사용자 한도로 로컬 파생한다', () => {
    const { db } = fakeDb({ limit: 90 })
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    const view = t.getProviderUsage('claude-gateway', NOW)

    expect(view.month.budget).toBe(90)
    expect(view.month.source).toBe('local')
  })

  it('기준선이 없으면 asOf 0 으로 조회한다', () => {
    const { db } = fakeDb()
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    t.getProviderUsage('claude-gateway', NOW)

    expect(db.sumUsageByBoundariesForProvider).toHaveBeenCalledWith(
      'claude-gateway',
      expect.anything(),
      0
    )
  })
})

describe('UsageTracker.refreshProvider', () => {
  it('fetcher 가 없으면 아무 것도 하지 않는다', async () => {
    const { db, upsert } = fakeDb()
    const broadcast = vi.fn()
    const t = new UsageTracker(db, broadcast, { spendingLimitUsd: () => 300 })

    await t.refreshProvider('claude-gateway')

    expect(upsert).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('원격 갱신이 로컬 원장을 건드리지 않는다', async () => {
    const { db, upsert, insertTurnUsage, insertTurnModelUsage } = fakeDb()
    const fetcher: UsageFetcher = { fetchUsage: vi.fn().mockResolvedValue(snapshot()) }
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300, fetcher })

    await t.refreshProvider('claude-gateway')

    expect(upsert).toHaveBeenCalledTimes(1)
    // 원장 쓰기는 단 한 번도 일어나지 않는다.
    expect(insertTurnUsage).not.toHaveBeenCalled()
    expect(insertTurnModelUsage).not.toHaveBeenCalled()
  })

  it('baselineUsable 미지정은 false 로 영속한다 (fail-closed)', async () => {
    const { db, upsert } = fakeDb()
    const fetcher: UsageFetcher = {
      fetchUsage: vi.fn().mockResolvedValue(snapshot({ baselineUsable: undefined }))
    }
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300, fetcher })

    await t.refreshProvider('claude-gateway')

    const envelope = JSON.parse(upsert.mock.calls[0][0].reportJson)
    expect(envelope.baselineUsable).toBe(false)
  })

  it('fetch 가 던져도 예외가 새지 않고 저장하지 않는다', async () => {
    const { db, upsert } = fakeDb()
    const fetcher: UsageFetcher = {
      fetchUsage: vi.fn().mockRejectedValue(new Error('사내망 밖'))
    }
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300, fetcher })

    await expect(t.refreshProvider('claude-gateway')).resolves.toBeUndefined()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('fetch 가 null 을 주면 저장하지 않는다', async () => {
    const { db, upsert } = fakeDb()
    const fetcher: UsageFetcher = { fetchUsage: vi.fn().mockResolvedValue(null) }
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300, fetcher })

    await t.refreshProvider('claude-gateway')

    expect(upsert).not.toHaveBeenCalled()
  })

  it('갱신 후 해당 provider delta 만 push 한다', async () => {
    const { db } = fakeDb()
    const seen: UsageDelta[] = []
    const fetcher: UsageFetcher = { fetchUsage: vi.fn().mockResolvedValue(snapshot()) }
    const t = new UsageTracker(db, (d) => seen.push(d), {
      spendingLimitUsd: () => 300,
      fetcher
    })

    await t.refreshProvider('claude-gateway')

    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ scope: 'provider', providerKey: 'claude-gateway' })
  })
})
