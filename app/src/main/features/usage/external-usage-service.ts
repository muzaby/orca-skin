import type { CostSummary, ExternalUsageReport, ProviderUsageEntry } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import type { SecretStore } from '../../infra/config/secret-store'
import type { StaticUsageProviderModule, ExternalUsageProvider } from '../../contracts/usage-report'
import { createSecretFacade, effectiveLimitFromReport } from './external-usage'
import { createHttpUsageReportProvider } from './http-usage-report'
import { getLogger } from '../../infra/log/registry'

interface ServiceDeps {
  db: DbQueries
  secretStore: SecretStore
  providers: readonly StaticUsageProviderModule[]
  fetchImpl?: typeof fetch
  clock?: () => number
  logger?: (message: string, meta?: Record<string, unknown>) => void
}

const DEFAULT_TIMEOUT_MS = 5000

export class ExternalUsageService {
  private readonly providers = new Map<string, StaticUsageProviderModule>()
  private readonly inFlight = new Map<string, Promise<ExternalUsageReport | null>>()
  private readonly store = new Map<string, Map<string, unknown>>()
  // 마지막 fetch 가 성공한(fresh) providerKey 집합(in-memory). 실패 시 제거되어 캐시 baseline
  // 을 stale 로 쓰고, 재성공 시 다시 담겨 권위값이 복구된다(0111). 재시작 직후 첫 성공 전까지는
  // 미포함 = stale.
  private readonly freshProviderKeys = new Set<string>()
  private readonly fetchImpl: typeof fetch
  private readonly clock: () => number
  private readonly logger: (message: string, meta?: Record<string, unknown>) => void

  constructor(private readonly deps: ServiceDeps) {
    for (const p of deps.providers) this.providers.set(`${p.adapter}-${p.provider}`, p)
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.clock = deps.clock ?? Date.now
    this.logger =
      deps.logger ??
      ((message, meta) =>
        getLogger()
          .child('usage')
          .warn('usage.external.warning', { message, ...(meta !== undefined ? { meta } : {}) }))
  }

  hasProvider(providerKey: string): boolean {
    return this.providers.has(providerKey)
  }

  entry(
    providerKey: string,
    summary: CostSummary,
    localLimitUsd: number | null
  ): ProviderUsageEntry {
    const externalReport = this.readCachedReport(providerKey)
    const stale = !this.freshProviderKeys.has(providerKey)
    return {
      providerKey,
      summary,
      limitUsd: externalReport?.quota?.limitUsd ?? localLimitUsd,
      ...(externalReport ? { externalReport } : {}),
      effectiveLimit: effectiveLimitFromReport(summary, localLimitUsd, externalReport, stale)
    }
  }

  async refresh(providerKey: string): Promise<ExternalUsageReport | null> {
    const module = this.providers.get(providerKey)
    if (!module) return this.readCachedReport(providerKey)
    const existing = this.inFlight.get(providerKey)
    if (existing) return existing
    const promise = this.fetchAndPersist(providerKey, module).finally(() =>
      this.inFlight.delete(providerKey)
    )
    this.inFlight.set(providerKey, promise)
    return promise
  }

  async refreshAll(providerKeys?: readonly string[]): Promise<void> {
    const keys = providerKeys?.filter((k) => this.providers.has(k)) ?? [...this.providers.keys()]
    await Promise.all(keys.map((key) => this.refresh(key)))
  }

  private providerFor(module: StaticUsageProviderModule): ExternalUsageProvider | null {
    if (module.usage?.provider) return module.usage.provider
    if (module.usage?.config) return createHttpUsageReportProvider(module.usage.config)
    return null
  }

  private async fetchAndPersist(
    providerKey: string,
    module: StaticUsageProviderModule
  ): Promise<ExternalUsageReport | null> {
    const provider = this.providerFor(module)
    if (!provider) return this.readCachedReport(providerKey)
    const timeoutMs = module.usage?.config?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const report = await provider.fetchUsageReport({
        providerKey,
        fetch: this.fetchImpl,
        signal: controller.signal,
        secret: createSecretFacade(this.deps.secretStore, providerKey),
        env: process.env as Record<string, string>,
        settings: module.defaultSettings,
        store: this.providerStore(providerKey),
        logger: this.logger,
        clock: this.clock
      })
      if (report) {
        this.persist(report)
        this.freshProviderKeys.add(providerKey)
        return report
      }
      // provider 가 리포트 없이 반환 — baseline 유지, stale 표시.
      return this.staleBaseline(providerKey)
    } catch (err) {
      // 네트워크 오류(throw) — 마지막 성공 baseline 으로 폴백하고 stale 표시(0111).
      this.logger('fetch failed — using cached baseline', { providerKey, err: String(err) })
      return this.staleBaseline(providerKey)
    } finally {
      clearTimeout(timer)
    }
  }

  private providerStore(providerKey: string): {
    get(key: string): unknown
    set(key: string, value: unknown): void
  } {
    let scoped = this.store.get(providerKey)
    if (!scoped) {
      scoped = new Map<string, unknown>()
      this.store.set(providerKey, scoped)
    }
    return { get: (key) => scoped.get(key), set: (key, value) => scoped.set(key, value) }
  }

  private persist(report: ExternalUsageReport): void {
    this.deps.db.upsertProviderUsageReport({
      providerKey: report.providerKey,
      reportJson: JSON.stringify(report),
      fetchedAt: report.fetchedAt,
      asOf: report.asOf ?? null,
      quotaLimitUsd: report.quota?.limitUsd ?? null,
      quotaUsedUsd: report.quota?.usedUsd ?? null,
      quotaRemainingUsd: report.quota?.remainingUsd ?? null,
      updatedAt: this.clock()
    })
  }

  // fetch 실패(리포트 없음/throw) 공용 폴백 — stale 표시 후 마지막 baseline 반환(0111).
  private staleBaseline(providerKey: string): ExternalUsageReport | null {
    this.freshProviderKeys.delete(providerKey)
    return this.readCachedReport(providerKey)
  }

  // 마지막으로 영속된 리포트(baseline). staleness 판정은 호출부의 freshProviderKeys 가 소유한다(0111).
  private readCachedReport(providerKey: string): ExternalUsageReport | null {
    const row = this.deps.db.getProviderUsageReport(providerKey)
    if (!row) return null
    try {
      return JSON.parse(row.report_json) as ExternalUsageReport
    } catch {
      return null
    }
  }
}
