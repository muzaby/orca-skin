import { describe, expect, it, vi } from 'vitest'
import { ExternalUsageService } from './external-usage-service'
import type { ExternalUsageProvider, StaticUsageProviderModule } from '../../contracts/usage-report'
import type { CostSummary, ExternalUsageReport } from '../../../shared/ipc'
import { createSecretFacade } from './external-usage'

// 0157 — 서비스가 raw SecretStore 대신 provider 별 네임스페이스 뷰만 받는다.
function emptySecretFacade(): ReturnType<typeof createSecretFacade> {
  return { get: () => null, set: () => undefined }
}

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

function report(providerKey: string, fetchedAt: number, usedUsd: number): ExternalUsageReport {
  return {
    providerKey,
    fetchedAt,
    source: 'external',
    quota: { usedUsd, limitUsd: 100, remainingUsd: 100 - usedUsd }
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
      secretFor: () => emptySecretFacade(),
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

  it('calls provider-owned usage hook with framework context and persists its report', async () => {
    const backingDb = db()
    const fetchImpl = vi.fn()
    const provider: ExternalUsageProvider = {
      async fetchUsageReport(ctx) {
        expect(ctx.providerKey).toBe('claude-enterprise')
        expect(ctx.fetch).toBe(fetchImpl)
        expect(ctx.signal).toBeInstanceOf(AbortSignal)
        expect(ctx.env).toBe(process.env)
        expect(ctx.settings).toEqual({ env: { USAGE_ENDPOINT: 'https://usage.example' } })
        expect(ctx.clock()).toBe(200)

        ctx.store.set('token', { value: 'cached', expiresAt: 300 })
        expect(ctx.store.get('token')).toEqual({ value: 'cached', expiresAt: 300 })

        ctx.secret.set('refresh-token', 'next-token')
        expect(ctx.secret.get('refresh-token')).toBe('next-token')
        ctx.logger('hook invoked', { providerKey: ctx.providerKey })

        return report(ctx.providerKey, ctx.clock(), 40)
      }
    }
    const secrets = new Map<string, string>()
    const logger = vi.fn()
    const service = new ExternalUsageService({
      db: backingDb as never,
      secretFor: (providerKey) =>
        createSecretFacade(
          {
            get: (key: string) => secrets.get(key),
            set: (key: string, value: string) => {
              secrets.set(key, value)
            },
            delete: (key: string) => {
              secrets.delete(key)
            }
          },
          providerKey
        ),
      providers: [
        {
          adapter: 'claude',
          provider: 'enterprise',
          defaultSettings: { env: { USAGE_ENDPOINT: 'https://usage.example' } },
          usage: { provider }
        }
      ],
      fetchImpl: fetchImpl as never,
      clock: () => 200,
      logger
    })

    await expect(service.refresh('claude-enterprise')).resolves.toMatchObject({
      providerKey: 'claude-enterprise',
      quota: { usedUsd: 40 }
    })
    expect(backingDb.getProviderUsageReport()?.report_json).toContain('"usedUsd":40')
    expect(secrets.get('provider:claude-enterprise:refresh-token')).toBe('next-token')
    expect(logger).toHaveBeenCalledWith('hook invoked', { providerKey: 'claude-enterprise' })
  })

  it('falls back to cached report when hook returns null', async () => {
    const backingDb = db()
    const service = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [
        {
          adapter: 'claude',
          provider: 'cached',
          defaultSettings: {},
          usage: {
            provider: {
              async fetchUsageReport() {
                return report('claude-cached', 100, 70)
              }
            }
          }
        }
      ],
      clock: () => 100
    })
    await service.refresh('claude-cached')

    const fallbackService = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [
        {
          adapter: 'claude',
          provider: 'cached',
          defaultSettings: {},
          usage: {
            provider: {
              async fetchUsageReport() {
                return null
              }
            }
          }
        }
      ],
      clock: () => 200
    })

    await expect(fallbackService.refresh('claude-cached')).resolves.toMatchObject({
      providerKey: 'claude-cached',
      quota: { usedUsd: 70 }
    })
    expect(fallbackService.entry('claude-cached', summary(10), 50).effectiveLimit).toMatchObject({
      source: 'external',
      usedUsd: 70,
      stale: true
    })
  })

  it('falls back to cached baseline (stale) when fetch throws, without rejecting', async () => {
    const backingDb = db()
    const seed = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [
        {
          adapter: 'claude',
          provider: 'net',
          defaultSettings: {},
          usage: {
            provider: {
              async fetchUsageReport() {
                return report('claude-net', 100, 55)
              }
            }
          }
        }
      ],
      clock: () => 100
    })
    await seed.refresh('claude-net') // persist baseline usedUsd=55

    const offline = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [
        {
          adapter: 'claude',
          provider: 'net',
          defaultSettings: {},
          usage: {
            provider: {
              async fetchUsageReport() {
                throw new Error('ENOTFOUND usage.example')
              }
            }
          }
        }
      ],
      clock: () => 200
    })

    // throw 를 캐시 baseline 으로 삼켜 reject 하지 않는다.
    await expect(offline.refresh('claude-net')).resolves.toMatchObject({ quota: { usedUsd: 55 } })
    expect(offline.entry('claude-net', summary(10), 50).effectiveLimit).toMatchObject({
      source: 'external',
      usedUsd: 55,
      stale: true
    })
  })

  it('marks fresh on success and recovers stale→fresh across fail→success', async () => {
    const backingDb = db()
    let mode: 'ok' | 'throw' = 'ok'
    const service = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [
        {
          adapter: 'claude',
          provider: 'flap',
          defaultSettings: {},
          usage: {
            provider: {
              async fetchUsageReport(ctx) {
                if (mode === 'throw') throw new Error('offline')
                return report(ctx.providerKey, 100, 42)
              }
            }
          }
        }
      ],
      clock: () => 100
    })

    await service.refresh('claude-flap')
    expect(service.entry('claude-flap', summary(10), 50).effectiveLimit.stale).toBe(false)

    mode = 'throw'
    await service.refresh('claude-flap')
    expect(service.entry('claude-flap', summary(10), 50).effectiveLimit.stale).toBe(true)

    mode = 'ok'
    await service.refresh('claude-flap')
    expect(service.entry('claude-flap', summary(10), 50).effectiveLimit.stale).toBe(false)
  })

  it('treats static provider modules as provider-agnostic registry entries', async () => {
    const calls: string[] = []
    const modules: StaticUsageProviderModule[] = ['alpha', 'beta'].map((provider) => ({
      adapter: 'claude',
      provider,
      defaultSettings: {},
      usage: {
        provider: {
          async fetchUsageReport(ctx) {
            calls.push(ctx.providerKey)
            return report(ctx.providerKey, 100, ctx.providerKey === 'claude-alpha' ? 1 : 2)
          }
        }
      }
    }))
    const service = new ExternalUsageService({
      db: db() as never,
      secretFor: () => emptySecretFacade(),
      providers: modules,
      clock: () => 100
    })

    expect(service.hasProvider('claude-alpha')).toBe(true)
    expect(service.hasProvider('claude-beta')).toBe(true)
    expect(service.hasProvider('claude-bedrock')).toBe(false)

    await service.refreshAll()
    expect(calls.sort()).toEqual(['claude-alpha', 'claude-beta'])
  })
})
