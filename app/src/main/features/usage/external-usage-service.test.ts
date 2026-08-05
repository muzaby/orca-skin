import { describe, expect, it, vi } from 'vitest'
import { ExternalUsageService, sampleKey } from './external-usage-service'
import type { ExternalUsageProvider, StaticUsageProviderModule } from '../../contracts/usage-report'
import type { CostSummary, ExternalUsageReport } from '../../../shared/ipc'
import type { UsageSampleOutcome, UsageSourcePort } from '../../contracts/usage-source'
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

// 0173 — fetchImpl 은 필수다. 이 스위트는 원격에 나가지 않으므로 빈 응답 스텁을 준다
// (실제 요청 경로를 보는 케이스는 자기 fetchImpl 을 따로 주입한다).
const stubFetch: typeof fetch = async () => new Response('{}', { status: 200 })

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
      fetchImpl: stubFetch,
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
      fetchImpl: stubFetch,
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
      fetchImpl: stubFetch,
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
      fetchImpl: stubFetch,
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
      fetchImpl: stubFetch,
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
      fetchImpl: stubFetch,
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
      fetchImpl: stubFetch,
      clock: () => 100
    })

    expect(service.hasProvider('claude-alpha')).toBe(true)
    expect(service.hasProvider('claude-beta')).toBe(true)
    expect(service.hasProvider('claude-bedrock')).toBe(false)

    await service.refreshAll()
    expect(calls.sort()).toEqual(['claude-alpha', 'claude-beta'])
  })

  // ── 구독 경로 (0176) ───────────────────────────────────────────────────────

  it('구독 결과를 리포트로 영속하고 fresh 로 표시한다', async () => {
    const backingDb = keyedDb()
    const service = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [subscribingModule('corp')],
      fetchImpl: stubFetch,
      sources: sourcePort({ 'usage-corp': () => okSample({ usedUsd: 70, limitUsd: 100 }) }),
      clock: () => 100
    })

    const result = await service.refresh('claude-corp')

    expect(result).toMatchObject({ providerKey: 'claude-corp', quota: { usedUsd: 70 } })
    expect(backingDb.rows.get('claude-corp')).toBeDefined()
    expect(service.entry('claude-corp', summary(10), 50).effectiveLimit).toMatchObject({
      source: 'external',
      usedUsd: 70,
      limitUsd: 100,
      stale: false
    })
  })

  it('같은 source 를 구독한 두 provider 가 invoke 1회를 공유한다', async () => {
    const backingDb = keyedDb()
    const invoked: string[] = []
    const service = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [subscribingModule('corp'), subscribingModule('lab')],
      fetchImpl: stubFetch,
      sources: sourcePort({
        'usage-corp': () => {
          invoked.push('usage-corp')
          return okSample({ usedUsd: 12, limitUsd: 100 })
        }
      }),
      clock: () => 100
    })

    await service.refreshAll()

    expect(invoked).toEqual(['usage-corp'])
    expect(backingDb.rows.get('claude-corp')).toBeDefined()
    expect(backingDb.rows.get('claude-lab')).toBeDefined()
    expect(service.entry('claude-corp', summary(10), 50).effectiveLimit.stale).toBe(false)
    expect(service.entry('claude-lab', summary(10), 50).effectiveLimit.stale).toBe(false)
  })

  it('invoke 실패 시 baseline 을 stale 로 돌려준다', async () => {
    const backingDb = keyedDb()
    let mode: 'ok' | 'fail' = 'ok'
    const service = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [subscribingModule('corp')],
      fetchImpl: stubFetch,
      sources: sourcePort({
        'usage-corp': () =>
          mode === 'ok'
            ? okSample({ usedUsd: 33, limitUsd: 100 })
            : {
                ok: false as const,
                sourceId: 'usage-corp',
                operation: 'quota',
                reason: 'invoke_failed' as const
              }
      }),
      logger: () => undefined,
      clock: () => 100
    })

    await service.refresh('claude-corp')
    mode = 'fail'
    await expect(service.refresh('claude-corp')).resolves.toMatchObject({ quota: { usedUsd: 33 } })
    expect(service.entry('claude-corp', summary(10), 50).effectiveLimit).toMatchObject({
      usedUsd: 33,
      stale: true
    })
  })

  it('map 이 전부 null 이면 baseline 을 유지한다', async () => {
    const backingDb = keyedDb()
    const module: StaticUsageProviderModule = {
      adapter: 'claude',
      provider: 'corp',
      defaultSettings: {},
      usage: {
        subscription: {
          sourceId: 'usage-corp',
          request: { operation: 'quota' },
          // 이 provider 가 이해하지 못하는 포맷 — null 이 정상 경로다.
          map: (sample) => {
            const payload = sample.payload as { quota?: { usedUsd?: number } }
            if (typeof payload?.quota?.usedUsd !== 'number') return null
            return {
              providerKey: 'claude-corp',
              fetchedAt: sample.fetchedAt,
              source: 'external',
              quota: { usedUsd: payload.quota.usedUsd, limitUsd: 100, remainingUsd: null }
            }
          }
        }
      }
    }
    const service = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [module],
      fetchImpl: stubFetch,
      sources: sourcePort({
        'usage-corp': () => ({
          ok: true as const,
          sample: {
            sourceId: 'usage-corp',
            operation: 'quota',
            fetchedAt: 100,
            status: 200,
            payload: '<html>maintenance</html>'
          }
        })
      }),
      clock: () => 100
    })

    await expect(service.refresh('claude-corp')).resolves.toBeNull()
    expect(backingDb.rows.size).toBe(0)
    expect(service.entry('claude-corp', summary(10), 50).effectiveLimit).toMatchObject({
      source: 'local',
      usedUsd: 10
    })
  })

  it('sourceId 미지정 구독은 연결된 source 전부를 받는다', async () => {
    const backingDb = keyedDb()
    const invoked: string[] = []
    const module: StaticUsageProviderModule = {
      adapter: 'claude',
      provider: 'corp',
      defaultSettings: {},
      usage: {
        subscription: {
          request: { operation: 'quota' },
          // 두 번째 source 만 이 provider 의 것이다.
          map: (sample) =>
            sample.sourceId === 'usage-lab'
              ? {
                  providerKey: 'claude-corp',
                  fetchedAt: sample.fetchedAt,
                  source: 'external',
                  quota: { usedUsd: 88, limitUsd: 100, remainingUsd: 12 }
                }
              : null
        }
      }
    }
    const service = new ExternalUsageService({
      db: backingDb as never,
      secretFor: () => emptySecretFacade(),
      providers: [module],
      fetchImpl: stubFetch,
      sources: sourcePort(
        {
          'usage-corp': () => {
            invoked.push('usage-corp')
            return okSample({ usedUsd: 1, limitUsd: 2 })
          },
          'usage-lab': () => {
            invoked.push('usage-lab')
            return okSample({ usedUsd: 88, limitUsd: 100 })
          }
        },
        [
          { sourceId: 'usage-corp', label: 'corp', connected: true },
          { sourceId: 'usage-lab', label: 'lab', connected: true },
          { sourceId: 'usage-off', label: 'off', connected: false }
        ]
      ),
      clock: () => 100
    })

    await service.refresh('claude-corp')

    // 연결되지 않은 source 는 부르지 않는다.
    expect(invoked.sort()).toEqual(['usage-corp', 'usage-lab'])
    expect(service.entry('claude-corp', summary(10), 50).effectiveLimit).toMatchObject({
      usedUsd: 88,
      stale: false
    })
  })

  it('subscription 이 config 보다 우선한다', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    const service = new ExternalUsageService({
      db: keyedDb() as never,
      secretFor: () => emptySecretFacade(),
      providers: [
        {
          ...subscribingModule('corp'),
          usage: {
            ...subscribingModule('corp').usage,
            config: { endpoint: 'https://legacy.invalid/report', map: {} }
          }
        }
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sources: sourcePort({ 'usage-corp': () => okSample({ usedUsd: 5, limitUsd: 100 }) }),
      clock: () => 100
    })

    await expect(service.refresh('claude-corp')).resolves.toMatchObject({ quota: { usedUsd: 5 } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('레거시 config 경로가 그대로 동작한다', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ used: 7, limit: 100 }), { status: 200 })
    )
    const service = new ExternalUsageService({
      db: keyedDb() as never,
      secretFor: () => emptySecretFacade(),
      providers: [
        {
          adapter: 'claude',
          provider: 'legacy',
          defaultSettings: {},
          usage: {
            config: {
              endpoint: 'https://legacy.invalid/report',
              map: { quotaUsedUsd: 'used', quotaLimitUsd: 'limit' }
            }
          }
        }
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sources: sourcePort({}),
      clock: () => 100
    })

    await expect(service.refresh('claude-legacy')).resolves.toMatchObject({
      quota: { usedUsd: 7, limitUsd: 100 }
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('source 포트가 없으면 구독 provider 는 baseline 을 유지한다', async () => {
    const service = new ExternalUsageService({
      db: keyedDb() as never,
      secretFor: () => emptySecretFacade(),
      providers: [subscribingModule('corp')],
      fetchImpl: stubFetch,
      logger: () => undefined,
      clock: () => 100
    })

    await expect(service.refresh('claude-corp')).resolves.toBeNull()
    expect(service.entry('claude-corp', summary(10), 50).effectiveLimit.source).toBe('local')
  })

  it('map 컨텍스트는 fetch·secret 을 노출하지 않는다', async () => {
    let seen: string[] = []
    const module: StaticUsageProviderModule = {
      adapter: 'claude',
      provider: 'corp',
      defaultSettings: { tenant: 'x' },
      usage: {
        subscription: {
          sourceId: 'usage-corp',
          request: { operation: 'quota' },
          map: (sample, ctx) => {
            seen = Object.keys(ctx).sort()
            return {
              providerKey: ctx.providerKey,
              fetchedAt: sample.fetchedAt,
              source: 'external',
              quota: { usedUsd: 1, limitUsd: 2, remainingUsd: 1 }
            }
          }
        }
      }
    }
    const service = new ExternalUsageService({
      db: keyedDb() as never,
      secretFor: () => emptySecretFacade(),
      providers: [module],
      fetchImpl: stubFetch,
      sources: sourcePort({ 'usage-corp': () => okSample({ usedUsd: 1, limitUsd: 2 }) }),
      clock: () => 100
    })

    await service.refresh('claude-corp')

    expect(seen).toEqual(['clock', 'logger', 'providerKey', 'settings', 'store'])
  })
})

// ── 구독 경로 테스트 헬퍼 (0176) ──────────────────────────────────────────────

// providerKey 별로 행을 나누는 DB 스텁 — 구독 팬아웃은 provider 2개 이상을 봐야 한다.
function keyedDb(): {
  rows: Map<string, string>
  getProviderUsageReport: (providerKey: string) => { report_json: string } | null
  upsertProviderUsageReport: (next: { providerKey: string; reportJson: string }) => void
} {
  const rows = new Map<string, string>()
  return {
    rows,
    getProviderUsageReport: (providerKey) => {
      const json = rows.get(providerKey)
      return json === undefined ? null : { report_json: json }
    },
    upsertProviderUsageReport: (next) => {
      rows.set(next.providerKey, next.reportJson)
    }
  }
}

function okSample(quota: { usedUsd: number; limitUsd: number }): UsageSampleOutcome {
  return {
    ok: true,
    sample: {
      sourceId: 'usage-corp',
      operation: 'quota',
      fetchedAt: 100,
      status: 200,
      payload: { quota }
    }
  }
}

function sourcePort(
  handlers: Record<string, () => UsageSampleOutcome>,
  infos?: readonly { sourceId: string; label: string; connected: boolean }[]
): UsageSourcePort {
  const list =
    infos ??
    Object.keys(handlers).map((sourceId) => ({ sourceId, label: sourceId, connected: true }))
  return {
    list: () => list,
    invoke: async (sourceId, request) => {
      const handler = handlers[sourceId]
      if (!handler) {
        return { ok: false, sourceId, operation: request.operation, reason: 'unknown_source' }
      }
      const outcome = handler()
      // 표본은 실제로 호출된 source 를 가리켜야 한다(팬아웃 판정이 여기에 걸린다).
      return outcome.ok ? { ok: true, sample: { ...outcome.sample, sourceId } } : outcome
    }
  }
}

// 같은 형상의 구독 모듈 — 이름만 다르다.
function subscribingModule(provider: string): StaticUsageProviderModule {
  return {
    adapter: 'claude',
    provider,
    defaultSettings: {},
    usage: {
      subscription: {
        sourceId: 'usage-corp',
        request: { operation: 'quota' },
        map: (sample, ctx) => {
          const payload = sample.payload as { quota?: { usedUsd?: number; limitUsd?: number } }
          const usedUsd = payload?.quota?.usedUsd
          if (typeof usedUsd !== 'number') return null
          const limitUsd = payload.quota?.limitUsd ?? null
          return {
            providerKey: ctx.providerKey,
            fetchedAt: sample.fetchedAt,
            source: 'external',
            quota: {
              usedUsd,
              limitUsd,
              remainingUsd: limitUsd === null ? null : Math.max(0, limitUsd - usedUsd)
            }
          }
        }
      }
    }
  }
}

describe('sampleKey', () => {
  it('params 키 순서가 달라도 같은 호출은 같은 키다', () => {
    expect(
      sampleKey('usage-corp', { operation: 'quota', params: { a: 1, b: { y: 2, x: 1 } } })
    ).toBe(sampleKey('usage-corp', { operation: 'quota', params: { b: { x: 1, y: 2 }, a: 1 } }))
  })

  it('source·operation·params 가 다르면 키가 갈린다', () => {
    const base = sampleKey('usage-corp', { operation: 'quota', params: { scope: 'month' } })
    expect(sampleKey('usage-lab', { operation: 'quota', params: { scope: 'month' } })).not.toBe(
      base
    )
    expect(sampleKey('usage-corp', { operation: 'detail', params: { scope: 'month' } })).not.toBe(
      base
    )
    expect(sampleKey('usage-corp', { operation: 'quota', params: { scope: 'week' } })).not.toBe(
      base
    )
    expect(sampleKey('usage-corp', { operation: 'quota' })).not.toBe(base)
  })
})
