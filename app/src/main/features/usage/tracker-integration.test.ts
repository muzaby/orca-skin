import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyMigrations } from '../../infra/db/migrate'
import { UsageQueries } from '../../infra/db/usage-queries'
import type { UsageBreakdown, ProviderUsageReportUpsert } from '../../infra/db/types'
import type { TurnContext } from '../../contracts/turn'
import { localDayKey, localMonthKey } from '../../../shared/usage/stats'
import { boundaries } from '../../../shared/time/clock'
import type { UsageDelta, UsageLimitsView } from '../../../shared/usage/limits'
import { UsageTracker } from './tracker'
import type { UsageSnapshot } from './fetcher'
import { normalizeUsageBreakdown } from './breakdown'

const NOW = new Date(2026, 9, 6, 12).getTime()
const D = localDayKey(NOW),
  MONTH = localMonthKey(NOW)
const resources: Database.Database[] = []
afterEach(() => {
  for (const db of resources.splice(0)) db.close()
  vi.useRealTimers()
})
function setup(
  supported = true,
  withFetcher = true
): {
  db: Database.Database
  queries: UsageQueries
  push: ReturnType<typeof vi.fn<(delta: UsageDelta) => void>>
  fetch: ReturnType<typeof vi.fn<(key: string) => Promise<UsageSnapshot | null>>>
  supports: ReturnType<typeof vi.fn<(key: string) => boolean>>
  tracker: UsageTracker
} {
  const db = new Database(':memory:')
  resources.push(db)
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  db.prepare(
    "INSERT INTO sessions(id,backend,provider_key,created_at,updated_at) VALUES('s','claude','p',1,1),('q','claude','q',1,1)"
  ).run()
  const queries = new UsageQueries(db),
    push = vi.fn<(delta: UsageDelta) => void>()
  const fetch = vi.fn<(_: string) => Promise<UsageSnapshot | null>>()
  const supports = vi.fn((p: string) => supported && p === 'p')
  const tracker = new UsageTracker(queries, push, {
    spendingLimitUsd: () => 100,
    ...(withFetcher ? { fetcher: { supports, fetchUsage: fetch } } : {})
  })
  return { db, queries, push, fetch, supports, tracker }
}
function snap(over: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    providerKey: 'p',
    asOf: NOW,
    fetchedAt: NOW,
    limitUsd: 100,
    usedUsd: null,
    remainingUsd: null,
    raw: {},
    ...over
  }
}
function report(over: Partial<ProviderUsageReportUpsert> = {}): ProviderUsageReportUpsert {
  return {
    providerKey: 'p',
    reportJson: '{}',
    fetchedAt: NOW,
    asOf: NOW,
    quotaLimitUsd: 100,
    quotaUsedUsd: null,
    quotaRemainingUsd: null,
    updatedAt: NOW,
    ...over
  }
}
function local(q: UsageQueries, day = D, cost = 9, session = 's', m = 'sdk-only'): void {
  const usage = q.insertTurnUsage({
    sessionId: session,
    messageId: null,
    createdAt: new Date(`${day}T10:00:00`).getTime(),
    inputTokens: 100,
    outputTokens: 20,
    cacheCreationInputTokens: 10,
    cacheReadInputTokens: 5,
    totalCostUsd: cost
  })
  q.insertTurnModelUsage({
    turnUsageId: usage,
    model: m,
    inputTokens: 100,
    outputTokens: 20,
    cacheCreationInputTokens: 10,
    cacheReadInputTokens: 5,
    costUsd: cost,
    contextWindow: null
  })
}
function dump(db: Database.Database): unknown[][] {
  return [
    'provider_usage_report_cache',
    'provider_usage_periods',
    'provider_usage_period_models'
  ].map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY 1,2,3`).all())
}
async function refresh(
  s: ReturnType<typeof setup>,
  snapshot: UsageSnapshot
): Promise<UsageLimitsView | null> {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  s.fetch.mockResolvedValue(snapshot)
  return s.tracker.refreshProvider('p')
}

describe('원격 사용량 SQLite 저장·합성 종단', () => {
  it('캐시·일·월 total·독립 모델을 NULL 그대로 저장하고 원장은 건드리지 않는다', async () => {
    const s = setup()
    local(s.queries)
    const before = s.db.prepare('SELECT COUNT(*) AS n FROM turn_usage').get()
    await refresh(
      s,
      snap({
        daily: [{ day: D, total: { costUsd: 7 }, models: [{ model: 'm', inputTokens: 3 }] }],
        monthly: [{ month: MONTH, models: [{ model: 'm', costUsd: 4 }] }]
      })
    )
    expect(s.queries.getProviderUsageReport('p')).toMatchObject({
      fetched_at: NOW,
      quota_limit_usd: 100
    })
    expect(s.queries.listProviderUsagePeriods({ periodKind: 'day' })).toEqual([
      expect.objectContaining({
        period: D,
        cost_usd: 7,
        input_tokens: null,
        fetched_at: NOW,
        updated_at: NOW
      })
    ])
    expect(s.queries.listProviderUsagePeriodModels({ periodKind: 'day' })[0]).toMatchObject({
      model: 'm',
      input_tokens: 3,
      cost_usd: null
    })
    expect(s.queries.listProviderUsagePeriodModels({ periodKind: 'month' })).toHaveLength(1)
    expect(s.db.prepare('SELECT COUNT(*) AS n FROM turn_usage').get()).toEqual(before)
    expect(s.db.prepare('SELECT COUNT(*) AS n FROM turn_model_usage').get()).toEqual({ n: 1 })
  })
  it('다른 기간은 누적하고 같은 기간은 전체 최신값으로 갱신한다', async () => {
    const s = setup()
    await refresh(
      s,
      snap({
        daily: [
          { day: '2026-10-01', total: { costUsd: 1 } },
          { day: '2026-10-02', total: { costUsd: 2 } }
        ]
      })
    )
    await refresh(
      s,
      snap({
        daily: [
          { day: '2026-10-02', total: { inputTokens: 8 } },
          { day: '2026-10-03', total: { costUsd: 3 } }
        ]
      })
    )
    const rows = s.queries.listProviderUsagePeriods({ periodKind: 'day' })
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => [r.period, r.cost_usd, r.input_tokens])).toEqual([
      ['2026-10-01', 1, null],
      ['2026-10-02', null, 8],
      ['2026-10-03', 3, null]
    ])
  })
  it('total·모델 미제공과 빈 집합은 보존하고 보고한 모델 집합만 교체한다', async () => {
    const s = setup()
    await refresh(
      s,
      snap({
        daily: [
          {
            day: D,
            total: { costUsd: 5 },
            models: [
              { model: 'a', costUsd: 2 },
              { model: 'b', costUsd: 3 }
            ]
          }
        ]
      })
    )
    await refresh(s, snap({ daily: [{ day: D, total: null, models: [] }] }))
    expect(s.queries.listProviderUsagePeriods({ periodKind: 'day' })[0].cost_usd).toBe(5)
    expect(
      s.queries.listProviderUsagePeriodModels({ periodKind: 'day' }).map((r) => r.model)
    ).toEqual(['a', 'b'])
    await refresh(s, snap({ daily: [{ day: D, models: [{ model: 'b', inputTokens: 4 }] }] }))
    expect(s.queries.listProviderUsagePeriods({ periodKind: 'day' })[0].cost_usd).toBe(5)
    expect(s.queries.listProviderUsagePeriodModels({ periodKind: 'day' })).toEqual([
      expect.objectContaining({ model: 'b', input_tokens: 4, cost_usd: null })
    ])
    await refresh(s, snap({ daily: [{ day: D, total: { costUsd: 8 } }] }))
    expect(s.queries.listProviderUsagePeriodModels({ periodKind: 'day' })).toHaveLength(1)
  })
  it('형식 오류는 세 테이블 쓰기와 push 모두 0이다', async () => {
    const s = setup()
    await refresh(s, snap({ daily: [{ day: D, total: { costUsd: 5 } }] }))
    const before = dump(s.db)
    s.push.mockClear()
    await expect(
      refresh(s, snap({ usedUsd: 99, daily: [{ day: '2026-02-30', total: { costUsd: 7 } }] }))
    ).rejects.toThrow()
    expect(dump(s.db)).toEqual(before)
    expect(s.push).not.toHaveBeenCalled()
  })
  it('모델 insert PK 실패는 선행 캐시·total·모델 삭제까지 전부 롤백한다', () => {
    const s = setup()
    const valid = normalizeUsageBreakdown(
      snap({ daily: [{ day: D, total: { costUsd: 5 }, models: [{ model: 'a', costUsd: 5 }] }] })
    )
    s.queries.saveProviderUsageReport(report(), valid)
    const before = dump(s.db)
    const broken: UsageBreakdown = {
      totals: [{ ...valid.totals[0], costUsd: 99 }],
      modelSets: [
        {
          ...valid.modelSets[0],
          models: [valid.modelSets[0].models[0], valid.modelSets[0].models[0]]
        }
      ]
    }
    expect(() => s.queries.saveProviderUsageReport(report({ quotaUsedUsd: 99 }), broken)).toThrow()
    expect(dump(s.db)).toEqual(before)
  })
  it('DB 저장 실패는 tracker까지 전파하고 push를 하지 않는다', async () => {
    const s = setup()
    const before = dump(s.db)
    s.db.exec(
      "CREATE TRIGGER reject_usage BEFORE INSERT ON provider_usage_period_models BEGIN SELECT RAISE(FAIL, 'injected failure'); END"
    )
    await expect(
      refresh(
        s,
        snap({ daily: [{ day: D, total: { costUsd: 5 }, models: [{ model: 'a', costUsd: 5 }] }] })
      )
    ).rejects.toThrow('injected failure')
    expect(dump(s.db)).toEqual(before)
    expect(s.push).not.toHaveBeenCalled()
  })
  it.each([
    {
      monthly: [{ month: MONTH, total: { inputTokens: 1 } }],
      usedUsd: null,
      expected: 0,
      source: 'remote'
    },
    { monthly: undefined, usedUsd: null, expected: 0, source: 'remote-daily' },
    { monthly: undefined, usedUsd: 33, expected: 33, source: 'remote' }
  ])(
    '비용 NULL 날짜와 월 선택이 조회·push까지 같다: %j',
    async ({ monthly, usedUsd, expected, source }) => {
      const s = setup()
      local(s.queries)
      const v = await refresh(
        s,
        snap({
          monthly,
          usedUsd,
          daily: usedUsd === 33 ? undefined : [{ day: D, total: { inputTokens: 5 } }]
        })
      )
      expect(v?.month).toMatchObject({ used: expected, source })
      expect(v?.week).toMatchObject({
        used: usedUsd === 33 ? 9 : 0,
        source: usedUsd === 33 ? 'local' : 'remote-daily'
      })
      expect(s.push).toHaveBeenCalledWith({
        scope: 'provider',
        providerKey: 'p',
        value: s.tracker.getProviderUsage('p', NOW)
      })
    }
  )
  it.each(['7d', '30d', 'all'] as const)(
    '사용량 탭 %s 원격 칸 NULL은 SDK로 채우지 않는다',
    async (range) => {
      const s = setup()
      local(s.queries, D, 9, 's', 'm')
      local(s.queries, D, 2, 'q', 'other')
      await refresh(
        s,
        snap({
          daily: [{ day: D, total: { costUsd: 7 }, models: [{ model: 'm', inputTokens: 3 }] }]
        })
      )
      const r = s.tracker.usageStats(range, NOW)
      expect(r.days).toEqual([
        {
          day: D,
          inputTokens: 100,
          outputTokens: 20,
          cacheCreationInputTokens: 10,
          cacheReadInputTokens: 5,
          totalCostUsd: 9
        }
      ])
      expect(r.models.find((m) => m.model === 'm')).toEqual({
        model: 'm',
        inputTokens: 3,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        costUsd: 0
      })
    }
  )
  it('새 tracker는 fetch 없이 저장된 원격 값을 쓰고 global/boundary는 원격을 무시한다', async () => {
    const s = setup()
    local(s.queries)
    await refresh(s, snap({ daily: [{ day: D, total: { costUsd: 7 } }] }))
    s.fetch.mockClear()
    const next = new UsageTracker(s.queries, s.push, {
      spendingLimitUsd: () => 100,
      fetcher: { supports: s.supports, fetchUsage: s.fetch }
    })
    expect(next.getProviderUsage('p', NOW).month.used).toBe(7)
    expect(next.usageStats('all', NOW).days[0].totalCostUsd).toBe(7)
    expect(s.fetch).not.toHaveBeenCalled()
    expect(next.getGlobalUsage(NOW).month).toMatchObject({ used: 9, source: 'local' })
    next.refreshBoundary(NOW)
    expect(s.push.mock.calls.at(-1)?.[0]).toMatchObject({
      scope: 'boundary',
      value: { month: { used: 9, source: 'local' } }
    })
  })
  it.each([false, true])(
    '원격 칸 유무 %s와 무관하게 SDK 원장·세션 비용·최신 사용량·전역은 증가한다',
    async (remote) => {
      const s = setup()
      local(s.queries)
      if (remote)
        await refresh(
          s,
          snap({
            daily: [{ day: D, total: { costUsd: 7 }, models: [{ model: 'm', inputTokens: 3 }] }]
          })
        )
      const before = s.tracker.getProviderUsage('p', NOW),
        stats = s.tracker.usageStats('all', NOW)
      const rows = s.db.prepare('SELECT COUNT(*) AS n FROM turn_usage').get() as { n: number }
      vi.useFakeTimers()
      vi.setSystemTime(NOW)
      s.tracker.recordTurnUsage(
        { dbSessionId: 's', currentAssistantMessageId: null, providerKey: 'p' } as TurnContext,
        {
          type: 'telemetry',
          sessionId: 's',
          usage: { inputTokens: 2, outputTokens: 1, costUsd: 4, model: 'm' }
        }
      )
      expect(s.db.prepare('SELECT COUNT(*) AS n FROM turn_usage').get()).toEqual({ n: rows.n + 1 })
      expect(s.queries.sumSessionCostUsd('s')).toBe(13)
      expect(s.queries.getLatestTurnUsage('s')?.turn.input_tokens).toBe(2)
      expect(s.tracker.getGlobalUsage(NOW).month.used).toBe(13)
      const after = s.tracker.getProviderUsage('p', NOW),
        afterStats = s.tracker.usageStats('all', NOW)
      expect(after.month.used).toBe(before.month.used + (remote ? 0 : 4))
      expect(after.week.used).toBe(before.week.used + (remote ? 0 : 4))
      expect(afterStats.days[0].totalCostUsd).toBe(stats.days[0].totalCostUsd + (remote ? 0 : 4))
      if (remote) expect(afterStats.models).toEqual(stats.models)
    }
  )
  it('비용 NULL 날짜·월 항목 존재는 조회에서 보존하며 경계 결과에는 SDK 합계만 있다', () => {
    const s = setup()
    local(s.queries)
    s.queries.saveProviderUsageReport(
      report(),
      normalizeUsageBreakdown(
        snap({
          daily: [{ day: D, total: { inputTokens: 2 } }],
          monthly: [{ month: MONTH, total: { outputTokens: 3 } }]
        })
      )
    )
    expect(
      s.queries.providerPeriodCosts('p', { fromDay: '2026-10-01', toDay: D, month: MONTH })
    ).toEqual({ days: [{ day: D, costUsd: null }], month: { costUsd: null } })
    expect(
      s.queries.providerPeriodCosts('q', { fromDay: '2026-10-01', toDay: D, month: MONTH })
    ).toEqual({ days: [], month: null })
    expect(Object.keys(s.queries.sumUsageByBoundariesForProvider('p', boundaries(NOW)))).toEqual([
      'day',
      'week',
      'month'
    ])
  })
  it('세션 삭제로 provider NULL이 된 SDK 행을 LEFT JOIN 로 보존한다', () => {
    const s = setup()
    local(s.queries)
    s.db.prepare("DELETE FROM sessions WHERE id='s'").run()
    expect(s.queries.sumUsageByProviderDaySince(0)[0]).toMatchObject({
      provider_key: null,
      total_cost_usd: 9
    })
    expect(s.queries.sumModelUsageByProviderDaySince(0)[0]).toMatchObject({
      provider_key: null,
      cost_usd: 9
    })
    expect(s.queries.sumUsageByDayForProvider('p', 0)).toEqual([])
  })
  it.each(['missing', 'unsupported', 'empty'] as const)(
    '원격 행이 권위 없는 %s 상태는 기존 SQL만 사용한다',
    async (mode) => {
      const s = setup(mode !== 'unsupported', mode !== 'missing')
      local(s.queries)
      if (mode !== 'empty')
        s.queries.saveProviderUsageReport(
          report(),
          normalizeUsageBreakdown(
            snap({
              daily: [{ day: D, total: { costUsd: 7 }, models: [{ model: 'm', inputTokens: 3 }] }]
            })
          )
        )
      const a = vi.spyOn(s.queries, 'sumUsageByProviderDaySince'),
        b = vi.spyOn(s.queries, 'sumModelUsageByProviderDaySince')
      const r = s.tracker.usageStats('all', NOW)
      expect(r.days[0].totalCostUsd).toBe(s.queries.sumUsageByDaySince(0)[0].total_cost_usd)
      expect(r.models[0].costUsd).toBe(s.queries.sumUsageByModelSince(0)[0].cost_usd)
      expect(a).not.toHaveBeenCalled()
      expect(b).not.toHaveBeenCalled()
    }
  )
  it.each(['missing', 'unsupported', 'empty', 'null-day'] as const)(
    'provider 호출 수 계약 %s',
    (mode) => {
      const s = setup(mode !== 'unsupported', mode !== 'missing')
      local(s.queries)
      if (mode === 'null-day')
        s.queries.saveProviderUsageReport(
          report(),
          normalizeUsageBreakdown(snap({ daily: [{ day: D, total: { inputTokens: 2 } }] }))
        )
      const a = vi.spyOn(s.queries, 'providerPeriodCosts'),
        b = vi.spyOn(s.queries, 'sumUsageByDayForProvider'),
        c = vi.spyOn(s.queries, 'sumUsageByBoundariesForProvider'),
        r = vi.spyOn(s.queries, 'getProviderUsageReport')
      s.tracker.getProviderUsage('p', NOW)
      expect(a).toHaveBeenCalledTimes(mode === 'empty' || mode === 'null-day' ? 1 : 0)
      expect(r).toHaveBeenCalledTimes(mode === 'empty' || mode === 'null-day' ? 1 : 0)
      expect(b).toHaveBeenCalledTimes(mode === 'null-day' ? 1 : 0)
      expect(c.mock.calls).toEqual([['p', boundaries(NOW)]])
    }
  )
})
