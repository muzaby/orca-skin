import type { ExternalUsageReport, UsageReportConfig } from '../../../shared/ipc'
import type { ExternalUsageContext, ExternalUsageProvider } from '../../contracts/usage-report'

function pathValue(input: unknown, path: string | undefined): unknown {
  if (!path) return undefined
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && key in cur) return (cur as Record<string, unknown>)[key]
    return undefined
  }, input)
}

function numberValue(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function stringValue(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function expandString(input: string, ctx: ExternalUsageContext): string {
  return input.replace(/\$\{(SECRET|ENV):([^}]+)\}/g, (_m, kind: string, name: string) => {
    if (kind === 'SECRET') return ctx.secret.get(name) ?? ''
    return ctx.env[name] ?? ''
  })
}

function expandUnknown(input: unknown, ctx: ExternalUsageContext): unknown {
  if (typeof input === 'string') return expandString(input, ctx)
  if (Array.isArray(input)) return input.map((v) => expandUnknown(v, ctx))
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, expandUnknown(v, ctx)])
    )
  }
  return input
}

export function createHttpUsageReportProvider(config: UsageReportConfig): ExternalUsageProvider {
  return {
    async fetchUsageReport(ctx): Promise<ExternalUsageReport | null> {
      try {
        const headers = Object.fromEntries(
          Object.entries(config.headers ?? {}).map(([k, v]) => [k, expandString(v, ctx)])
        )
        const body =
          config.body === undefined ? undefined : JSON.stringify(expandUnknown(config.body, ctx))
        const res = await ctx.fetch(expandString(config.endpoint, ctx), {
          method: config.method ?? 'GET',
          headers,
          body,
          signal: ctx.signal
        })
        if (!res.ok) return null
        const json: unknown = await res.json()
        const usedUsd = numberValue(pathValue(json, config.map.quotaUsedUsd))
        const limitUsd = numberValue(pathValue(json, config.map.quotaLimitUsd))
        const remainingUsd = numberValue(pathValue(json, config.map.quotaRemainingUsd))
        const totalCostUsd = numberValue(pathValue(json, config.map.totalCostUsd))
        const asOfRaw = pathValue(json, config.map.asOf)
        const asOf =
          numberValue(asOfRaw) ??
          (stringValue(asOfRaw) ? Date.parse(stringValue(asOfRaw)!) : undefined)
        return {
          providerKey: ctx.providerKey,
          fetchedAt: ctx.clock(),
          ...(Number.isFinite(asOf) ? { asOf } : {}),
          source: 'external',
          scope: config.scope ?? 'unknown',
          quota:
            usedUsd !== undefined || limitUsd !== undefined || remainingUsd !== undefined
              ? { usedUsd, limitUsd: limitUsd ?? null, remainingUsd: remainingUsd ?? null }
              : undefined,
          totals: totalCostUsd !== undefined ? { costUsd: totalCostUsd } : undefined
        }
      } catch (e) {
        ctx.logger('external usage report fetch failed', {
          error: e instanceof Error ? e.message : String(e)
        })
        return null
      }
    }
  }
}
