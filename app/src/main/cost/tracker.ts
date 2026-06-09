import { webContents } from 'electron'
import { CHANNELS, type CostSummary, type CostUsageTotals } from '../../shared/ipc'
import type { DbQueries } from '../db'
import { boundaries } from './boundaries'

const ZERO_TOTALS: CostUsageTotals = {
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0
}

function emptySummary(): CostSummary {
  return {
    day: { ...ZERO_TOTALS },
    week: { ...ZERO_TOTALS },
    month: { ...ZERO_TOTALS }
  }
}

export class CostTracker {
  private summary: CostSummary = emptySummary()

  constructor(private readonly db: DbQueries) {}

  recompute(now: number = Date.now()): CostSummary {
    const b = boundaries(now)
    this.summary = {
      day: this.db.sumUsageSince(b.dayStart),
      week: this.db.sumUsageSince(b.weekStart),
      month: this.db.sumUsageSince(b.monthStart)
    }
    return this.getSummary()
  }

  recordAndBroadcast(now: number = Date.now()): CostSummary {
    const summary = this.recompute(now)
    for (const wc of webContents.getAllWebContents()) {
      if (!wc.isDestroyed()) wc.send(CHANNELS.costSummaryEvent, summary)
    }
    return summary
  }

  getSummary(): CostSummary {
    return {
      day: { ...this.summary.day },
      week: { ...this.summary.week },
      month: { ...this.summary.month }
    }
  }
}
