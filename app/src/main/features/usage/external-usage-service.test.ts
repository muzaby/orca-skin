import { describe, expect, it, vi } from 'vitest'
import { ExternalUsageService, type UsageSpecEntry } from './external-usage-service'
import type { CostSummary, ExternalUsageReport } from '../../../shared/ipc'
import type { UsageSampleOutcome, UsageSourcePort } from '../../contracts/usage-source'

// 0183 — 경로가 하나다: 선언(`Provider.usage`)에서 파생된 spec 이 **선언한 provider 자신**을
// 부른다. 구 `StaticUsageProviderModule`·`config`/`provider` 경로·표본 팬아웃은 없다.

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

function report(providerKey: string, fetchedAt: number, usedUsd: number): ExternalUsageReport {
  return {
    providerKey,
    fetchedAt,
    source: 'external',
    quota: { usedUsd, limitUsd: 100, remainingUsd: 100 - usedUsd }
  }
}

// 표본 payload 를 그대로 리포트로 옮기는 최소 spec.
function spec(
  providerKey: string,
  providerId: string,
  map?: UsageSpecEntry['spec']['map']
): UsageSpecEntry {
  return {
    providerKey,
    providerId,
    spec: {
      operation: '/api/usage',
      map:
        map ??
        ((sample, ctx) => {
          const payload = sample.payload as { used?: number } | string
          if (typeof payload === 'string' || typeof payload.used !== 'number') return null
          return {
            providerKey: ctx.providerKey,
            fetchedAt: sample.fetchedAt,
            source: 'external',
            quota: { usedUsd: payload.used, limitUsd: 100, remainingUsd: 100 - payload.used }
          }
        })
    }
  }
}

function sourcePort(outcome: (providerId: string) => UsageSampleOutcome): UsageSourcePort & {
  calls: string[]
} {
  const calls: string[] = []
  return {
    calls,
    list: () => [],
    invoke: async (sourceId) => {
      calls.push(sourceId)
      return outcome(sourceId)
    }
  }
}

describe('ExternalUsageService — 선언 기반 단일 경로 (0183)', () => {
  it('선언한 provider 자신을 부르고 표본을 리포트로 옮긴다', async () => {
    const rows = db()
    const sources = sourcePort((sourceId) => ({
      ok: true,
      sample: {
        sourceId,
        operation: '/api/usage',
        fetchedAt: 100,
        payload: { used: 30 }
      }
    }))
    const service = new ExternalUsageService({
      db: rows as never,
      specs: () => [spec('claude-corp', 'corp-gateway')],
      sources
    })

    const result = await service.refresh('claude-corp')

    // 호출 대상 = 선언 주체. sourceId 조인이 없다.
    expect(sources.calls).toEqual(['corp-gateway'])
    expect(result?.quota?.usedUsd).toBe(30)
    expect(rows.rows.has('claude-corp')).toBe(true)
  })

  it('map 이 남의 providerKey 를 적어도 선언에서 파생된 키로 고정된다', async () => {
    const rows = db()
    const service = new ExternalUsageService({
      db: rows as never,
      specs: () => [
        spec('claude-corp', 'corp-gateway', (sample) => ({
          providerKey: 'claude-anthropic', // ← 남의 키
          fetchedAt: sample.fetchedAt,
          source: 'external',
          quota: { usedUsd: 1, limitUsd: 2, remainingUsd: 1 }
        }))
      ],
      sources: sourcePort((sourceId) => ({
        ok: true,
        sample: { sourceId, operation: '/api/usage', fetchedAt: 1, payload: {} }
      }))
    })

    const result = await service.refresh('claude-corp')

    expect(result?.providerKey).toBe('claude-corp')
    expect(rows.rows.has('claude-anthropic')).toBe(false)
  })

  it('map 이 null 이면 baseline 을 stale 로 유지한다', async () => {
    const rows = db()
    rows.rows.set('claude-corp', JSON.stringify(report('claude-corp', 50, 20)))
    const service = new ExternalUsageService({
      db: rows as never,
      specs: () => [spec('claude-corp', 'corp-gateway')],
      // payload 형식이 다르다 → map 이 null
      sources: sourcePort((sourceId) => ({
        ok: true,
        sample: { sourceId, operation: '/api/usage', fetchedAt: 60, payload: 'not json' }
      }))
    })

    const result = await service.refresh('claude-corp')

    expect(result?.fetchedAt).toBe(50)
    expect(service.entry('claude-corp', summary(), null).effectiveLimit.stale).toBe(true)
  })

  it('미인증(not_connected)은 오류가 아니라 stale baseline 이다', async () => {
    const rows = db()
    rows.rows.set('claude-corp', JSON.stringify(report('claude-corp', 50, 20)))
    const logs: string[] = []
    const service = new ExternalUsageService({
      db: rows as never,
      specs: () => [spec('claude-corp', 'corp-gateway')],
      sources: sourcePort(() => ({
        ok: false,
        sourceId: 'corp-gateway',
        operation: '/api/usage',
        reason: 'not_connected'
      })),
      logger: (message) => void logs.push(message)
    })

    await expect(service.refresh('claude-corp')).resolves.toMatchObject({ fetchedAt: 50 })
    expect(logs.some((m) => m.includes('invoke failed'))).toBe(true)
  })

  it('sources 미주입이면 항상 stale baseline 이다 — 조용한 성공을 만들지 않는다', async () => {
    const rows = db()
    rows.rows.set('claude-corp', JSON.stringify(report('claude-corp', 50, 20)))
    const service = new ExternalUsageService({
      db: rows as never,
      specs: () => [spec('claude-corp', 'corp-gateway')]
    })

    await expect(service.refresh('claude-corp')).resolves.toMatchObject({ fetchedAt: 50 })
    expect(service.entry('claude-corp', summary(), null).effectiveLimit.stale).toBe(true)
  })

  it('선언에 없는 providerKey 는 캐시만 돌려주고 호출하지 않는다', async () => {
    const sources = sourcePort(() => ({
      ok: false,
      sourceId: 'x',
      operation: '/api/usage',
      reason: 'unknown_source'
    }))
    const service = new ExternalUsageService({ db: db() as never, specs: () => [], sources })

    await expect(service.refresh('claude-anthropic')).resolves.toBeNull()
    expect(sources.calls).toEqual([])
  })

  it('한 틱이 겹쳐도 in-flight 로 합쳐 원격 호출은 1회다', async () => {
    const sources = sourcePort((sourceId) => ({
      ok: true,
      sample: { sourceId, operation: '/api/usage', fetchedAt: 1, payload: { used: 5 } }
    }))
    const service = new ExternalUsageService({
      db: db() as never,
      specs: () => [spec('claude-corp', 'corp-gateway')],
      sources
    })

    await Promise.all([service.refreshAll(), service.refreshAll()])

    expect(sources.calls).toEqual(['corp-gateway'])
  })

  it('선언한 providerKey 가 설정 열거에 없으면 경고를 남긴다 — 침묵 금지 (0183)', async () => {
    const logs: { message: string; meta?: Record<string, unknown> }[] = []
    const service = new ExternalUsageService({
      db: db() as never,
      specs: () => [spec('claude-typo', 'corp-gateway')],
      sources: sourcePort((sourceId) => ({
        ok: true,
        sample: { sourceId, operation: '/api/usage', fetchedAt: 1, payload: { used: 5 } }
      })),
      logger: (message, meta) => void logs.push({ message, ...(meta ? { meta } : {}) })
    })

    // cron 이 넘기는 실제 열거에는 'claude-anthropic' 만 있다.
    await service.refreshAll(['claude-anthropic'])

    expect(logs.some((l) => l.meta?.providerKey === 'claude-typo')).toBe(true)
  })

  it('hasProvider 는 선언 여부를 그대로 반영한다', () => {
    const service = new ExternalUsageService({
      db: db() as never,
      specs: () => [spec('claude-corp', 'corp-gateway')]
    })
    expect(service.hasProvider('claude-corp')).toBe(true)
    expect(service.hasProvider('claude-anthropic')).toBe(false)
  })

  it('signal 을 전파한다 — 타임아웃이 호출을 끊을 수 있어야 한다', async () => {
    const seen: (AbortSignal | undefined)[] = []
    const service = new ExternalUsageService({
      db: db() as never,
      specs: () => [spec('claude-corp', 'corp-gateway')],
      sources: {
        list: () => [],
        invoke: vi.fn(async (sourceId: string, _req, signal?: AbortSignal) => {
          seen.push(signal)
          return {
            ok: true as const,
            sample: { sourceId, operation: '/api/usage', fetchedAt: 1, payload: { used: 5 } }
          }
        })
      }
    })

    await service.refresh('claude-corp')

    expect(seen[0]).toBeInstanceOf(AbortSignal)
  })
})
