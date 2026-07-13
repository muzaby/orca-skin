import { describe, expect, it, vi } from 'vitest'
import type { ExternalUsageContext } from '../../contracts/usage-report'
import { createHttpUsageReportProvider } from './http-usage-report'

function context(fetchImpl: ExternalUsageContext['fetch']): ExternalUsageContext {
  return {
    providerKey: 'claude-configured',
    fetch: fetchImpl,
    signal: new AbortController().signal,
    secret: { get: (name) => (name === 'TOKEN' ? 'secret-token' : null), set: () => undefined },
    env: { USAGE_URL: 'https://usage.example/report' },
    settings: {},
    store: { get: () => undefined, set: () => undefined },
    logger: vi.fn(),
    clock: () => 1234
  }
}

describe('createHttpUsageReportProvider', () => {
  it('expands provider config placeholders and maps JSON paths to an external usage report', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          quota: { limit: '100', used: 80, remaining: 20 },
          total: '81.5',
          asOf: '2026-07-13T00:00:00.000Z'
        }
      })
    })) as unknown as ExternalUsageContext['fetch']
    const provider = createHttpUsageReportProvider({
      endpoint: '${ENV:USAGE_URL}',
      method: 'POST',
      headers: { Authorization: 'Bearer ${SECRET:TOKEN}' },
      body: { provider: '${ENV:USAGE_URL}' },
      scope: 'provider-account',
      map: {
        quotaLimitUsd: 'data.quota.limit',
        quotaUsedUsd: 'data.quota.used',
        quotaRemainingUsd: 'data.quota.remaining',
        totalCostUsd: 'data.total',
        asOf: 'data.asOf'
      }
    })

    await expect(provider.fetchUsageReport(context(fetchImpl))).resolves.toMatchObject({
      providerKey: 'claude-configured',
      fetchedAt: 1234,
      source: 'external',
      scope: 'provider-account',
      quota: { limitUsd: 100, usedUsd: 80, remainingUsd: 20 },
      totals: { costUsd: 81.5 },
      asOf: Date.parse('2026-07-13T00:00:00.000Z')
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://usage.example/report',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer secret-token' },
        body: JSON.stringify({ provider: 'https://usage.example/report' })
      })
    )
  })

  it('returns null for failed or throwing provider fetches', async () => {
    const failed = createHttpUsageReportProvider({ endpoint: 'x', map: {} })
    await expect(
      failed.fetchUsageReport(context(vi.fn(async () => ({ ok: false })) as never))
    ).resolves.toBeNull()

    const throwing = createHttpUsageReportProvider({ endpoint: 'x', map: {} })
    await expect(
      throwing.fetchUsageReport(
        context(
          vi.fn(async () => {
            throw new Error('network down')
          }) as never
        )
      )
    ).resolves.toBeNull()
  })
})
