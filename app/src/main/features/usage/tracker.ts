import type { CostPeriodSummary, CostSummary } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import type { UsageSumRow } from '../../infra/db/types'
import { boundaries } from './boundaries'
import { NoopCorrectionSource, type UsageCorrectionSource } from './external-correction'

export class UsageTracker {
  private summary: CostSummary = emptySummary()

  // broadcast 는 컴포지션 루트(ipc/router.ts)가 주입한다 — IPC 송출 배선을 분리해 domain(L1)을
  // electron 비의존으로 유지한다(테스트 시 스파이로 검증 가능). 기본 no-op.
  // correction = 외부 사용량 보정 seam(기본 no-op). 후속 핸드오프에서 실 소스를 주입한다.
  constructor(
    private readonly db: DbQueries,
    private readonly broadcast: (summary: CostSummary) => void = () => {},
    private readonly correction: UsageCorrectionSource = new NoopCorrectionSource()
  ) {}

  // 남은 월 한도(USD). 외부 소스가 값을 주면 그것으로 보정하고, 없으면 로컬 폴백
  // (한도 − 이달 실사용). limit=null(무제한)이면 null. (IPC 배선은 후속 — seam 소비점.)
  async remainingUsd(limitUsd: number | null): Promise<number | null> {
    if (limitUsd == null) return null
    const external = await this.correction.fetchRemaining()
    if (external != null) return external
    return Math.max(0, limitUsd - this.summary.month.totalCostUsd)
  }

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
