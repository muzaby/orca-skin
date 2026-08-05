import type { CostSummary, ExternalUsageReport, ProviderUsageEntry } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import type {
  StaticUsageProviderModule,
  ExternalUsageProvider,
  ExternalUsageContext,
  UsageSubscription
} from '../../contracts/usage-report'
import type { UsageSampleRequest, UsageSourcePort } from '../../contracts/usage-source'
import { effectiveLimitFromReport } from './external-usage'
import { createHttpUsageReportProvider } from './http-usage-report'
import { UsageFeed } from './usage-feed'
import { getLogger } from '../../infra/log/registry'

interface ServiceDeps {
  db: DbQueries
  // 0157 — raw SecretStore 대신 **네임스페이스 팩토리**를 받는다. 이 서비스는 vault 전체를
  // 가질 이유가 없다(보고서 위험 #4: "Vault 를 broker 내부로 숨기고 consumer capability 만 주입").
  secretFor: (providerKey: string) => ExternalUsageContext['secret']
  providers: readonly StaticUsageProviderModule[]
  // **필수** (0173) — 기본값 `fetch` 를 두면 사내 프록시·사설 CA 를 못 타는 Node 스택으로
  // 조용히 나간다. 프로덕션은 `netFetch`(Chromium), 테스트는 스텁.
  fetchImpl: typeof fetch
  // 0176 — 인증된 호출의 결과를 나르는 포트(컴포지션 루트가 PluginHost 로 구현해 주입).
  // **미주입이면 구독형 모듈은 항상 stale 이다** — 조용한 성공을 만들지 않는다.
  sources?: UsageSourcePort
  clock?: () => number
  logger?: (message: string, meta?: Record<string, unknown>) => void
}

const DEFAULT_TIMEOUT_MS = 5000

// 표본 dedupe 키 — 두 provider 가 같은 호출을 요구하면 invoke 는 1회여야 한다(0176).
// 키 순서로 갈리지 않도록 **정렬된 안정 직렬화**를 쓴다.
export function sampleKey(sourceId: string, request: UsageSampleRequest): string {
  return `${sourceId}|${request.operation}|${stableJson(request.params)}`
}

function stableJson(value: unknown): string {
  if (value === undefined) return ''
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? ''
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`
}

export class ExternalUsageService {
  private readonly providers = new Map<string, StaticUsageProviderModule>()
  private readonly inFlight = new Map<string, Promise<ExternalUsageReport | null>>()
  private readonly store = new Map<string, Map<string, unknown>>()
  // 마지막 fetch 가 성공한(fresh) providerKey 집합(in-memory). 실패 시 제거되어 캐시 baseline
  // 을 stale 로 쓰고, 재성공 시 다시 담겨 권위값이 복구된다(0111). 재시작 직후 첫 성공 전까지는
  // 미포함 = stale.
  private readonly freshProviderKeys = new Set<string>()
  // 표본 단위 in-flight — providerKey 단위(`inFlight`)와 별개다. 같은 connector 호출을
  // 여러 provider 가 구독하면 여기서 합쳐진다.
  private readonly sampleInFlight = new Map<string, Promise<void>>()
  // 구독 listener 가 이번 사이클에 만들어 놓은 리포트. refresh 가 읽고 지운다.
  private readonly mappedByProvider = new Map<string, ExternalUsageReport>()
  private readonly feed: UsageFeed
  private readonly fetchImpl: typeof fetch
  private readonly clock: () => number
  private readonly logger: (message: string, meta?: Record<string, unknown>) => void

  constructor(private readonly deps: ServiceDeps) {
    for (const p of deps.providers) this.providers.set(`${p.adapter}-${p.provider}`, p)
    this.fetchImpl = deps.fetchImpl
    this.clock = deps.clock ?? Date.now
    this.logger =
      deps.logger ??
      ((message, meta) =>
        getLogger()
          .child('usage')
          .warn('usage.external.warning', { message, ...(meta !== undefined ? { meta } : {}) }))
    this.feed = new UsageFeed((message, meta) => this.logger(message, meta))
    for (const [providerKey, module] of this.providers) {
      const subscription = module.usage?.subscription
      if (subscription) this.subscribe(providerKey, module, subscription)
    }
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

  // 구독 등록 (0176). listener 는 **표본을 리포트로 바꾸는 일만** 한다 — 호출은 refresh 가,
  // 팬아웃은 feed 가 소유한다.
  private subscribe(
    providerKey: string,
    module: StaticUsageProviderModule,
    subscription: UsageSubscription
  ): void {
    const selector = {
      ...(subscription.sourceId !== undefined ? { sourceId: subscription.sourceId } : {}),
      operation: subscription.request.operation
    }
    this.feed.subscribe(selector, (sample) => {
      const mapped = subscription.map(sample, {
        providerKey,
        settings: module.defaultSettings,
        store: this.providerStore(providerKey),
        logger: this.logger,
        clock: this.clock
      })
      // `null` 은 "이 표본은 내 것이 아니다" 이며 정상 경로다 — baseline 을 건드리지 않는다.
      if (!mapped) return
      // providerKey 는 **구독자의 것으로 고정**한다. 모듈이 남의 키를 적어도 그 행을 덮지 못한다.
      const report: ExternalUsageReport = { ...mapped, providerKey }
      this.persist(report)
      this.freshProviderKeys.add(providerKey)
      this.mappedByProvider.set(providerKey, report)
    })
  }

  private async fetchViaSubscription(
    providerKey: string,
    subscription: UsageSubscription
  ): Promise<ExternalUsageReport | null> {
    const sources = this.deps.sources
    if (!sources) {
      this.logger('usage source port is not wired — keeping cached baseline', { providerKey })
      return this.staleBaseline(providerKey)
    }
    const sourceIds =
      subscription.sourceId !== undefined
        ? [subscription.sourceId]
        : sources
            .list()
            .filter((source) => source.connected)
            .map((source) => source.sourceId)
    if (sourceIds.length === 0) return this.staleBaseline(providerKey)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    this.mappedByProvider.delete(providerKey)
    try {
      await Promise.all(
        sourceIds.map((sourceId) =>
          this.sample(sources, sourceId, subscription.request, controller.signal)
        )
      )
    } finally {
      clearTimeout(timer)
    }

    const mapped = this.mappedByProvider.get(providerKey)
    this.mappedByProvider.delete(providerKey)
    // 표본이 하나도 매핑되지 않았으면(전부 null·전부 실패) baseline 을 stale 로 유지한다.
    return mapped ?? this.staleBaseline(providerKey)
  }

  // 같은 (source, operation, params) 호출을 합친다 — 두 provider 가 구독해도 원격은 1회다.
  private sample(
    sources: UsageSourcePort,
    sourceId: string,
    request: UsageSampleRequest,
    signal: AbortSignal
  ): Promise<void> {
    const key = sampleKey(sourceId, request)
    const existing = this.sampleInFlight.get(key)
    if (existing) return existing
    const promise = this.invokeAndPublish(sources, sourceId, request, signal).finally(() =>
      this.sampleInFlight.delete(key)
    )
    this.sampleInFlight.set(key, promise)
    return promise
  }

  private async invokeAndPublish(
    sources: UsageSourcePort,
    sourceId: string,
    request: UsageSampleRequest,
    signal: AbortSignal
  ): Promise<void> {
    const outcome = await sources.invoke(sourceId, request, signal)
    if (outcome.ok) {
      this.feed.publish(outcome.sample)
      return
    }
    this.logger('usage source invoke failed', {
      sourceId,
      operation: request.operation,
      reason: outcome.reason,
      ...(outcome.message !== undefined ? { message: outcome.message } : {})
    })
  }

  private async fetchAndPersist(
    providerKey: string,
    module: StaticUsageProviderModule
  ): Promise<ExternalUsageReport | null> {
    // 우선순위: subscription > provider > config (contracts/usage-report.ts 헤더).
    const subscription = module.usage?.subscription
    if (subscription) return this.fetchViaSubscription(providerKey, subscription)
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
        secret: this.deps.secretFor(providerKey),
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
