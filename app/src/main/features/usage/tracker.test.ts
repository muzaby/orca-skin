// 0186 — tracker 의 정본 조립·delta 방출·원격 갱신 계약. DB 는 fake 로 대체해 순수 단위로 둔다
// (실제 왕복은 `infra/db/queries.test.ts` 가 본다).

import { describe, expect, it, vi } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { claudeToNormalized, type MapContext } from '../../adapters/claude-map'
import type { UsageQueries } from '../../infra/db/usage-queries'
import { usageRowToTelemetry } from '../../infra/ipc/dto'
import type { NormalizedEvent, ProviderReportedTelemetry } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import type {
  ProviderUsageReportRow,
  TurnModelUsageInsert,
  TurnUsageInsert,
  TurnUsageRow
} from '../../infra/db/types'
import type { UsageDelta } from '../../../shared/usage/limits'
import { primaryModelScore } from '../../../shared/usage/primary-model'
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
  db: UsageQueries
  insertTurnUsage: ReturnType<typeof vi.fn>
  insertTurnModelUsage: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  sumForProvider: ReturnType<typeof vi.fn>
} {
  const insertTurnUsage = vi.fn().mockReturnValue(1)
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
  } as unknown as UsageQueries
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

function fetcherWith(
  fetchUsage: UsageFetcher['fetchUsage'],
  supports: UsageFetcher['supports'] = () => true
): UsageFetcher {
  return { supports, fetchUsage }
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
  it('지원 중인 provider 는 원격 값 위에 로컬 증분을 얹는다', () => {
    const { db } = fakeDb({ report: reportRow(), limit: 90 })
    const t = new UsageTracker(db, () => {}, {
      spendingLimitUsd: () => 300,
      fetcher: fetcherWith(vi.fn())
    })

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
    const t = new UsageTracker(db, () => {}, {
      spendingLimitUsd: () => 300,
      fetcher: fetcherWith(vi.fn())
    })

    const view = t.getProviderUsage('claude-gateway', NOW)

    expect(view.month.source).toBe('local')
    expect(view.month.used).toBe(40)
    // 기준선을 못 써도 한도는 원격이 정본이다.
    expect(view.month.budget).toBe(500)
  })

  it('봉투 파싱이 실패하면 기준선을 쓰지 않는다 (fail-closed)', () => {
    const { db } = fakeDb({ report: reportRow({ report_json: 'not json' }), limit: 90 })
    const t = new UsageTracker(db, () => {}, {
      spendingLimitUsd: () => 300,
      fetcher: fetcherWith(vi.fn())
    })

    expect(t.getProviderUsage('claude-gateway', NOW).month.source).toBe('local')
  })

  it('스냅샷이 없으면 사용자 한도로 로컬 파생한다', () => {
    const { db } = fakeDb({ limit: 90 })
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    const view = t.getProviderUsage('claude-gateway', NOW)

    expect(view.month.budget).toBe(90)
    expect(view.month.source).toBe('local')
  })

  it('fetcher 미주입이면 과거 cache row 를 무시한다', () => {
    const { db } = fakeDb({ report: reportRow(), limit: 90 })
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300 })

    const view = t.getProviderUsage('claude-gateway', NOW)

    expect(view.month).toMatchObject({ used: 40, budget: 90, source: 'local' })
  })

  it('현재 미지원 provider 면 과거 cache row 를 무시한다', () => {
    const { db } = fakeDb({ report: reportRow(), limit: 90 })
    const t = new UsageTracker(db, () => {}, {
      spendingLimitUsd: () => 300,
      fetcher: fetcherWith(vi.fn(), () => false)
    })

    const view = t.getProviderUsage('claude-gateway', NOW)

    expect(view.month).toMatchObject({ used: 40, budget: 90, source: 'local' })
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
    const fetcher = fetcherWith(vi.fn().mockResolvedValue(snapshot()))
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300, fetcher })

    await t.refreshProvider('claude-gateway')

    expect(upsert).toHaveBeenCalledTimes(1)
    // 원장 쓰기는 단 한 번도 일어나지 않는다.
    expect(insertTurnUsage).not.toHaveBeenCalled()
    expect(insertTurnModelUsage).not.toHaveBeenCalled()
  })

  it('baselineUsable 미지정은 false 로 영속한다 (fail-closed)', async () => {
    const { db, upsert } = fakeDb()
    const fetcher = fetcherWith(vi.fn().mockResolvedValue(snapshot({ baselineUsable: undefined })))
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300, fetcher })

    await t.refreshProvider('claude-gateway')

    const envelope = JSON.parse(upsert.mock.calls[0][0].reportJson)
    expect(envelope.baselineUsable).toBe(false)
  })

  it('fetch 오류를 caller 에 전달하고 저장하지 않는다', async () => {
    const { db, upsert } = fakeDb()
    const fetcher = fetcherWith(vi.fn().mockRejectedValue(new Error('사내망 밖')))
    const t = new UsageTracker(db, () => {}, { spendingLimitUsd: () => 300, fetcher })

    await expect(t.refreshProvider('claude-gateway')).rejects.toThrow('사내망 밖')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('지원 provider 의 fetch 가 null 이면 실패로 올리고 상태를 갱신하지 않는다', async () => {
    const { db, upsert } = fakeDb()
    const broadcast = vi.fn()
    const fetcher = fetcherWith(vi.fn().mockResolvedValue(null))
    const t = new UsageTracker(db, broadcast, { spendingLimitUsd: () => 300, fetcher })

    await expect(t.refreshProvider('claude-gateway')).rejects.toThrow(
      'Remote usage refresh returned no snapshot: claude-gateway'
    )

    expect(upsert).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('갱신 후 해당 provider delta 만 push 한다', async () => {
    const { db } = fakeDb()
    const seen: UsageDelta[] = []
    const fetcher = fetcherWith(vi.fn().mockResolvedValue(snapshot()))
    const t = new UsageTracker(db, (d) => seen.push(d), {
      spendingLimitUsd: () => 300,
      fetcher
    })

    await t.refreshProvider('claude-gateway')

    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ scope: 'provider', providerKey: 'claude-gateway' })
  })

  it('성공 시 provider 를 한 번 집계하고 broadcast value 를 반환한다', async () => {
    const { db, sumForProvider } = fakeDb()
    const seen: UsageDelta[] = []
    const t = new UsageTracker(db, (delta) => seen.push(delta), {
      spendingLimitUsd: () => 300,
      fetcher: fetcherWith(vi.fn().mockResolvedValue(snapshot()))
    })

    const value = await t.refreshProvider('claude-gateway')

    expect(sumForProvider).toHaveBeenCalledTimes(1)
    expect(seen[0]).toMatchObject({ scope: 'provider', value })
  })

  it('미지원 provider 는 fetch 와 cache write 를 건너뛴다', async () => {
    const { db, upsert } = fakeDb({ report: reportRow() })
    const fetchUsage = vi.fn()
    const t = new UsageTracker(db, () => {}, {
      spendingLimitUsd: () => 300,
      fetcher: fetcherWith(fetchUsage, () => false)
    })

    await expect(t.refreshProvider('claude-gateway')).resolves.toBeNull()
    expect(fetchUsage).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })
})

function turnCtx(over: Partial<TurnContext> = {}): TurnContext {
  return {
    dbSessionId: 'sess-1',
    currentAssistantMessageId: 7,
    providerKey: 'claude-gateway',
    ...over
  } as TurnContext
}

function telemetry(): Extract<NormalizedEvent, { type: 'telemetry' }> {
  return {
    type: 'telemetry',
    sessionId: 'sess-1',
    usage: { inputTokens: 10, outputTokens: 4, costUsd: 0.5, model: 'claude-sonnet-4' }
  } as Extract<NormalizedEvent, { type: 'telemetry' }>
}

describe('recordTurnUsage', () => {
  it('영향받은 provider 만 재집계한다', () => {
    const { db } = fakeDb()
    const recordAndBroadcast = vi.fn()
    const cost = new UsageTracker(db)
    vi.spyOn(cost, 'recordAndBroadcast').mockImplementation(recordAndBroadcast)

    cost.recordTurnUsage(turnCtx({ providerKey: 'claude-gateway' }), telemetry())

    // 정확히 1회, 그리고 이 턴의 providerKey 만 넘긴다 — 전 provider 를 훑지 않는다.
    expect(recordAndBroadcast).toHaveBeenCalledTimes(1)
    expect(recordAndBroadcast).toHaveBeenCalledWith('claude-gateway')
  })

  it('providerKey 가 없는 턴은 전역만 갱신한다', () => {
    const { db } = fakeDb()
    const recordAndBroadcast = vi.fn()
    const cost = new UsageTracker(db)
    vi.spyOn(cost, 'recordAndBroadcast').mockImplementation(recordAndBroadcast)

    cost.recordTurnUsage(turnCtx({ providerKey: null }), telemetry())

    expect(recordAndBroadcast).toHaveBeenCalledWith(null)
  })

  it('컨텍스트 0 인 턴은 원장에 적재하지도, 갱신하지도 않는다', () => {
    const { db, insertTurnUsage } = fakeDb()
    const recordAndBroadcast = vi.fn()
    const cost = new UsageTracker(db)
    vi.spyOn(cost, 'recordAndBroadcast').mockImplementation(recordAndBroadcast)

    const empty = {
      type: 'telemetry',
      sessionId: 'sess-1',
      usage: { inputTokens: 0, outputTokens: 0 }
    } as Extract<NormalizedEvent, { type: 'telemetry' }>
    cost.recordTurnUsage(turnCtx(), empty)

    expect(insertTurnUsage).not.toHaveBeenCalled()
    expect(recordAndBroadcast).not.toHaveBeenCalled()
  })
})

describe('UsageTracker 원장 기록', () => {
  it.each<ProviderReportedTelemetry>([{}, { inputTokens: 0 }, { outputTokens: 99 }])(
    '빈 컨텍스트는 기록과 broadcast를 생략한다: %j',
    (usage) => {
      const { db, insertTurnUsage } = fakeDb()
      const broadcast = vi.fn()
      const cost = new UsageTracker(db, broadcast)
      cost.recordTurnUsage(turnCtx(), { ...telemetry(), usage })
      expect(insertTurnUsage).not.toHaveBeenCalled()
      expect(broadcast).not.toHaveBeenCalled()
    }
  )

  it.each<ProviderReportedTelemetry>([
    { inputTokens: 1 },
    { cacheReadTokens: 1 },
    { cacheCreationTokens: 1 }
  ])('컨텍스트 세 종류의 기록 가드를 보존한다: %j', (usage) => {
    const { db, insertTurnUsage, sumForProvider } = fakeDb()
    const broadcast = vi.fn()
    const cost = new UsageTracker(db, broadcast)
    cost.recordTurnUsage(turnCtx(), { ...telemetry(), usage })
    expect(insertTurnUsage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', messageId: 7 })
    )
    expect(sumForProvider).toHaveBeenCalledTimes(1)
    expect(sumForProvider.mock.calls[0][0]).toBe('claude-gateway')
    expect(broadcast.mock.calls.map(([delta]) => delta.scope)).toEqual(['global', 'provider'])
  })

  it('session 또는 usage가 없으면 원장과 갱신을 건너뛴다', () => {
    const { db, insertTurnUsage } = fakeDb()
    const broadcast = vi.fn()
    const cost = new UsageTracker(db, broadcast)
    cost.recordTurnUsage(turnCtx({ dbSessionId: null }), telemetry())
    cost.recordTurnUsage(turnCtx(), { type: 'telemetry', sessionId: 'sess-1' })
    expect(insertTurnUsage).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('modelUsage 모든 행을 부모와 연결하고 원장 저장 후 갱신한다', () => {
    const { db, insertTurnUsage, insertTurnModelUsage } = fakeDb()
    const broadcast = vi.fn()
    const cost = new UsageTracker(db, broadcast)
    cost.recordTurnUsage(turnCtx(), {
      ...telemetry(),
      usage: {
        inputTokens: 10,
        model: 'fallback',
        modelUsage: {
          a: { inputTokens: 8, contextWindow: 200000 },
          b: { inputTokens: 2, costUsd: 0.2 }
        }
      }
    })
    expect(insertTurnModelUsage.mock.calls.map(([row]) => row)).toEqual([
      {
        turnUsageId: 1,
        model: 'a',
        inputTokens: 8,
        outputTokens: null,
        cacheCreationInputTokens: null,
        cacheReadInputTokens: null,
        costUsd: null,
        contextWindow: 200000
      },
      {
        turnUsageId: 1,
        model: 'b',
        inputTokens: 2,
        outputTokens: null,
        cacheCreationInputTokens: null,
        cacheReadInputTokens: null,
        costUsd: 0.2,
        contextWindow: null
      }
    ])
    expect(insertTurnUsage.mock.invocationCallOrder[0]).toBeLessThan(
      insertTurnModelUsage.mock.invocationCallOrder[0]
    )
    expect(insertTurnModelUsage.mock.invocationCallOrder[1]).toBeLessThan(
      broadcast.mock.invocationCallOrder[0]
    )
  })

  it('단일 모델의 top-level contextWindow를 보존하고 기록 오류를 전파한다', () => {
    const { db, insertTurnModelUsage } = fakeDb()
    const broadcast = vi.fn()
    const cost = new UsageTracker(db, broadcast)
    cost.recordTurnUsage(turnCtx(), {
      ...telemetry(),
      usage: { inputTokens: 10, model: 'single', contextWindow: 100000 }
    })
    expect(insertTurnModelUsage).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'single', contextWindow: 100000 })
    )
    const failure = new Error('ledger failed')
    insertTurnModelUsage.mockImplementation(() => {
      throw failure
    })
    broadcast.mockClear()
    expect(() => cost.recordTurnUsage(turnCtx(), telemetry())).toThrow(failure)
    expect(broadcast).not.toHaveBeenCalled()
  })
})

// 0247 IT-01 — SDK 정규화의 폴백 값이 기존 원장 게이트·복원까지 같은 값으로 도달한다.
// fake DB 는 insert 인자를 DB 행 형상으로 옮기기만 하고 컨텍스트 판정을 재구현하지 않는다.
describe('프록시 컨텍스트 사용량 원장·복원', () => {
  function mapTurn(messages: unknown[]): Extract<NormalizedEvent, { type: 'telemetry' }> {
    const ctx: MapContext = { sessionId: 'sess-1', cwd: '/w' }
    const events = messages.flatMap((message) => claudeToNormalized(message as SDKMessage, ctx))
    const ev = events.find((event) => event.type === 'telemetry')
    if (!ev || ev.type !== 'telemetry') throw new Error('Expected mapped turn telemetry')
    return ev
  }

  function zeroAssistant(): unknown {
    return {
      type: 'assistant',
      message: {
        content: [],
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0
        }
      }
    }
  }

  it('AC9 마지막 delta 입력 17,023을 1행 기록하고 같은 컨텍스트로 복원한다', () => {
    const ev = mapTurn([
      zeroAssistant(),
      { type: 'stream_event', event: { type: 'message_delta', usage: { input_tokens: 15432 } } },
      zeroAssistant(),
      { type: 'stream_event', event: { type: 'message_delta', usage: { input_tokens: 17023 } } },
      {
        type: 'result',
        subtype: 'success',
        usage: { input_tokens: 32455, output_tokens: 16 },
        total_cost_usd: 0.12,
        modelUsage: {
          'qwen3.8-27b': {
            inputTokens: 32455,
            outputTokens: 16,
            costUSD: 0.12,
            contextWindow: 200000
          }
        }
      }
    ])
    expect(ev.usage?.inputTokens).toBe(17023)

    const { db, insertTurnUsage, insertTurnModelUsage } = fakeDb()
    new UsageTracker(db).recordTurnUsage(turnCtx(), ev)

    expect(insertTurnUsage).toHaveBeenCalledTimes(1)
    const inserted = insertTurnUsage.mock.calls[0][0] as TurnUsageInsert
    expect(inserted).toMatchObject({
      sessionId: 'sess-1',
      messageId: 7,
      inputTokens: 17023,
      totalCostUsd: 0.12
    })
    const row: TurnUsageRow = {
      id: 1,
      session_id: inserted.sessionId,
      message_id: inserted.messageId,
      created_at: inserted.createdAt,
      input_tokens: inserted.inputTokens,
      output_tokens: inserted.outputTokens,
      cache_creation_input_tokens: inserted.cacheCreationInputTokens,
      cache_read_input_tokens: inserted.cacheReadInputTokens,
      total_cost_usd: inserted.totalCostUsd
    }
    const modelRows = insertTurnModelUsage.mock.calls.map(([value], index) => {
      const model = value as TurnModelUsageInsert
      return {
        id: index + 1,
        turn_usage_id: model.turnUsageId,
        model: model.model,
        input_tokens: model.inputTokens,
        output_tokens: model.outputTokens,
        cache_creation_input_tokens: model.cacheCreationInputTokens,
        cache_read_input_tokens: model.cacheReadInputTokens,
        cost_usd: model.costUsd,
        context_window: model.contextWindow
      }
    })
    const restored = usageRowToTelemetry(row, modelRows)
    expect(primaryModelScore(restored)).toBe(17023)
    expect(restored).toMatchObject({
      inputTokens: 17023,
      costUsd: 0.12,
      model: 'qwen3.8-27b',
      modelUsage: { 'qwen3.8-27b': { inputTokens: 32455, contextWindow: 200000 } }
    })
  })

  it('AC9 usage 미반환 프록시의 output-only delta는 원장을 기록하지 않는다', () => {
    const ev = mapTurn([
      zeroAssistant(),
      { type: 'stream_event', event: { type: 'message_delta', usage: { output_tokens: 16 } } },
      { type: 'result', subtype: 'success', usage: { input_tokens: 0, output_tokens: 16 } }
    ])
    expect(primaryModelScore(ev.usage ?? {})).toBe(0)

    const { db, insertTurnUsage, insertTurnModelUsage } = fakeDb()
    const broadcast = vi.fn()
    new UsageTracker(db, broadcast).recordTurnUsage(turnCtx(), ev)

    expect(insertTurnUsage).not.toHaveBeenCalled()
    expect(insertTurnModelUsage).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
  })
})
