import type { CostPeriodSummary, CostSummary } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import type { UsageSumRow } from '../../infra/db/types'
import { boundaries } from './boundaries'

export class CostTracker {
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
