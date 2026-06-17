import { webContents } from 'electron'
import { CHANNELS, type CostPeriodSummary, type CostSummary } from '../../shared/ipc'
import type { DbQueries } from '../db'
import type { UsageSumRow } from '../db/types'
import { boundaries } from './boundaries'

export class CostTracker {
  private summary: CostSummary = emptySummary()

  constructor(private readonly db: DbQueries) {}

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
    for (const wc of webContents.getAllWebContents()) {
      if (!wc.isDestroyed()) wc.send(CHANNELS.costSummaryEvent, summary)
    }
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
