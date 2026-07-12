import { describe, expect, it } from 'vitest'
import { ExternalUsageService } from './external-usage-service'
import type { ExternalUsageProvider, StaticUsageProviderModule } from '../../contracts/usage-report'
import type { CostSummary } from '../../../shared/ipc'

function summary(month = 10): CostSummary {
  const period = {
    totalCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0
  }
  return { day: period, week: period, month: { ...period, totalCostUsd: month }, updatedAt: 1 }
}

function db(): {
  getProviderUsageReport: () => { report_json: string } | null
  upsertProviderUsageReport: (next: { reportJson: string }) => void
} {
  let row: { report_json: string } | null = null
  return {
    getProviderUsageReport: () => row,
    upsertProviderUsageReport: (next: { reportJson: string }) => {
      row = { report_json: next.reportJson }
    }
  }
}

describe('ExternalUsageService', () => {
  it('keeps local summary but resolves effective limit from authoritative API report', async () => {
    const provider: ExternalUsageProvider = {
      async fetchUsageReport(ctx) {
        return {
          providerKey: ctx.providerKey,
          fetchedAt: 100,
          source: 'external',
          quota: { usedUsd: 80, limitUsd: 100, remainingUsd: 20 }
        }
      }
    }
    const module: StaticUsageProviderModule = {
      adapter: 'claude',
      provider: 'bedrock',
      defaultSettings: { env: {} },
      usage: { provider }
    }
    const service = new ExternalUsageService({
      db: db() as never,
      secretStore: { get: () => undefined, set: () => undefined } as never,
      providers: [module],
      clock: () => 100
    })

    await service.refresh('claude-bedrock')
    const entry = service.entry('claude-bedrock', summary(10), 50)

    expect(entry.summary.month.totalCostUsd).toBe(10)
    expect(entry.effectiveLimit).toMatchObject({
      source: 'external',
      usedUsd: 80,
      limitUsd: 100,
      remainingUsd: 20
    })
  })
})
