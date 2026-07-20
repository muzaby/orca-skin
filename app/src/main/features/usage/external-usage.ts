import type { CostSummary, ExternalUsageReport } from '../../../shared/ipc'
import type { SecretStore } from '../../infra/config/secret-store'
import {
  createNamespacedSecretFacade,
  providerSecretPrefix
} from '../../infra/config/secret-facade'
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

// 구현은 infra/config/secret-facade 로 승격(0130) — SSO 모듈과 `provider:<key>:` 네임스페이스
// 규약을 공유하기 위함(feature 교차 import 금지). 기존 시그니처는 무회귀 유지.
export function createSecretFacade(
  secretStore: SecretStore,
  providerKey: string
): ExternalUsageContext['secret'] {
  return createNamespacedSecretFacade(secretStore, providerSecretPrefix(providerKey))
}
