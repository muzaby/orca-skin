import type { CostSummary, ExternalUsageReport } from '../../../shared/ipc'
import type { SecretStore } from '../../infra/config/secret-store'
import type { ExternalUsageContext } from '../../contracts/usage-report'

export interface EffectiveUsageLimit {
  source: 'local' | 'external'
  usedUsd: number
  limitUsd: number | null
  remainingUsd: number | null
  fetchedAt?: number
  asOf?: number
  stale?: boolean
}

export function effectiveLimitFromReport(
  summary: CostSummary,
  localLimitUsd: number | null,
  report: ExternalUsageReport | null | undefined,
  stale = false
): EffectiveUsageLimit {
  const quota = report?.quota
  const limitUsd = quota?.limitUsd ?? localLimitUsd
  const usedUsd = quota?.usedUsd ?? report?.totals?.costUsd ?? summary.month.totalCostUsd
  const remainingUsd =
    quota?.remainingUsd ?? (limitUsd == null ? null : Math.max(0, limitUsd - usedUsd))
  return report
    ? {
        source: 'external',
        usedUsd,
        limitUsd,
        remainingUsd,
        fetchedAt: report.fetchedAt,
        asOf: report.asOf,
        stale
      }
    : { source: 'local', usedUsd: summary.month.totalCostUsd, limitUsd, remainingUsd }
}

export function createSecretFacade(
  secretStore: SecretStore,
  providerKey: string
): ExternalUsageContext['secret'] {
  const prefix = `provider:${providerKey}:`
  return {
    get: (name) => secretStore.get(`${prefix}${name}`) ?? null,
    set: (name, value) => secretStore.set(`${prefix}${name}`, value)
  }
}
