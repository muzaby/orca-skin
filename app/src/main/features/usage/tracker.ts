import type {
  CostPeriodSummary,
  CostSummary,
  UsageStats,
  UsageStatsRange
} from '../../../shared/ipc'
import { rangeSince } from '../../../shared/usage/stats'
import type { DbQueries } from '../../infra/db'
import type { DailyUsageRow, ModelUsageSumRow, UsageSumRow } from '../../infra/db/types'
import { boundaries } from './boundaries'

export class UsageTracker {
  private summary: CostSummary = emptySummary()

  // broadcast 는 컴포지션 루트(ipc/router.ts)가 주입한다 — IPC 송출 배선을 분리해 domain(L1)을
  // electron 비의존으로 유지한다(테스트 시 스파이로 검증 가능). 기본 no-op.
  constructor(
    private readonly db: DbQueries,
    private readonly broadcast: (summary: CostSummary) => void = () => {}
  ) {}

  recompute(now = Date.now()): CostSummary {
    const sums = this.db.sumUsageByBoundaries(boundaries(now))
    this.summary = {
      day: toPeriod(sums.day),
      week: toPeriod(sums.week),
      month: toPeriod(sums.month),
      updatedAt: now
    }
    return this.summary
  }

  recordAndBroadcast(): CostSummary {
    const summary = this.recompute()
    this.broadcast(summary)
    return summary
  }

  getSummary(): CostSummary {
    return this.summary
  }

  // 사용량 요약(0112) — 기간별 일 단위 시계열 + 모델별 집계. providerSummary 처럼 캐시 없이
  // 요청 시 스캔한다(설정 사용량 탭 조회 시점에만 필요). days 는 희소(사용 있던 날만) —
  // 제로필은 renderer 몫. since=null 은 '전체'(하한 없음)를 뜻한다.
  usageStats(range: UsageStatsRange, now = Date.now()): UsageStats {
    const since = rangeSince(range, now)
    return {
      range,
      since: range === 'all' ? null : since,
      days: this.db.sumUsageByDaySince(since).map(toStatsDay),
      models: this.db.sumUsageByModelSince(since).map(toStatsModel),
      updatedAt: now
    }
  }

  // provider 한정 summary(0080) — 전역 집계와 달리 캐시하지 않고 요청 시 DB 를 스캔한다
  // (설정 사용량 provider 서브탭 조회 시점에만 필요). 형태는 전역 CostSummary 와 동일.
  providerSummary(providerKey: string, now = Date.now()): CostSummary {
    const sums = this.db.sumUsageByBoundariesForProvider(providerKey, boundaries(now))
    return {
      day: toPeriod(sums.day),
      week: toPeriod(sums.week),
      month: toPeriod(sums.month),
      updatedAt: now
    }
  }
}

function toStatsDay(row: DailyUsageRow): UsageStats['days'][number] {
  return {
    day: row.day,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    totalCostUsd: row.total_cost_usd
  }
}

function toStatsModel(row: ModelUsageSumRow): UsageStats['models'][number] {
  return {
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    costUsd: row.cost_usd
  }
}

function toPeriod(row: UsageSumRow): CostPeriodSummary {
  return {
    totalCostUsd: row.total_cost_usd,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens
  }
}

function emptySummary(): CostSummary {
  const empty: CostPeriodSummary = {
    totalCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0
  }
  return { day: empty, week: empty, month: empty, updatedAt: 0 }
}
