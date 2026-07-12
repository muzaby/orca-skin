import type { CostSummary, ExternalUsageReport, ProviderUsageEntry } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import type { SecretStore } from '../../infra/config/secret-store'
import type { StaticUsageProviderModule, ExternalUsageProvider } from '../../contracts/usage-report'
import { createSecretFacade, effectiveLimitFromReport } from './external-usage'
import { createHttpUsageReportProvider } from './http-usage-report'

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
  private readonly fetchImpl: typeof fetch
  private readonly clock: () => number
  private readonly logger: (message: string, meta?: Record<string, unknown>) => void

  constructor(private readonly deps: ServiceDeps) {
    for (const p of deps.providers) this.providers.set(`${p.adapter}-${p.provider}`, p)
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.clock = deps.clock ?? Date.now
    this.logger =
      deps.logger ?? ((message, meta) => console.warn(`[external-usage] ${message}`, meta ?? ''))
  }

  hasProvider(providerKey: string): boolean {
    return this.providers.has(providerKey)
  }

  entry(
    providerKey: string,
    summary: CostSummary,
    localLimitUsd: number | null
  ): ProviderUsageEntry {
    const cached = this.readCachedReport(providerKey)
    const externalReport = cached?.report
    return {
      providerKey,
      summary,
      limitUsd: cached?.report.quota?.limitUsd ?? localLimitUsd,
      ...(externalReport ? { externalReport } : {}),
      effectiveLimit: effectiveLimitFromReport(
        summary,
        localLimitUsd,
        externalReport,
        cached?.stale ?? false
      )
    }
  }

  async refresh(providerKey: string): Promise<ExternalUsageReport | null> {
    const module = this.providers.get(providerKey)
    if (!module) return this.readCachedReport(providerKey)?.report ?? null
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
    if (!provider) return this.readCachedReport(providerKey)?.report ?? null
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
      if (report) this.persist(report)
      return report ?? this.readCachedReport(providerKey)?.report ?? null
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

  private readCachedReport(
    providerKey: string
  ): { report: ExternalUsageReport; stale: boolean } | null {
    const row = this.deps.db.getProviderUsageReport(providerKey)
    if (!row) return null
    try {
      return { report: JSON.parse(row.report_json) as ExternalUsageReport, stale: true }
    } catch {
      return null
    }
  }
}
