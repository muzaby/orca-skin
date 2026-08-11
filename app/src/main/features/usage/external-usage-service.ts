import type { CostSummary, ExternalUsageReport, ProviderUsageEntry } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import type { UsageMapContext } from '../../contracts/usage-report'
import type { UsageSample, UsageSampleRequest, UsageSourcePort } from '../../contracts/usage-source'
import { effectiveLimitFromReport } from './external-usage'
import { getLogger } from '../../infra/log/registry'

// 컴포지션 루트가 선언에서 뽑아 주입하는 한 줄. **`features/usage` 는 `features/providers` 를
// import 하지 않는다**(슬라이스 교차 금지) — 그래서 형상만 구조적으로 받는다.
export interface UsageSpecEntry {
  providerKey: string
  providerId: string
  spec: {
    operation: string
    params?: Record<string, unknown>
    map(sample: UsageSample, ctx: UsageMapContext): ExternalUsageReport | null
  }
}

interface ServiceDeps {
  db: DbQueries
  // 0183 — 구 `providers: StaticUsageProviderModule[]` 대체. 선언(`Provider.usage`)에서 파생된다.
  // **게터다** — 선언은 빌드 타임 고정이지만 주입 시점 결합을 피한다.
  specs: () => readonly UsageSpecEntry[]
  // 0176 — 인증된 호출의 결과를 나르는 포트(컴포지션 루트가 `ProviderApi` 로 구현해 주입, 0181).
  // **미주입이면 항상 stale 이다** — 조용한 성공을 만들지 않는다.
  sources?: UsageSourcePort
  clock?: () => number
  logger?: (message: string, meta?: Record<string, unknown>) => void
}

const DEFAULT_TIMEOUT_MS = 5000

// 사용량 서비스 (0099 → 0176 → **0183 단일 경로**).
//
// ── 0183 이 접은 것 ─────────────────────────────────────────────────────────
// 구 구조는 해소 경로가 셋(`config`·`provider`·`subscription`)이고 `sourceId` → provider,
// `adapter`/`provider` → 디렉토리 **두 조인**이 있었다. 앞의 두 경로는 모듈이 자기 손으로 요청을
// 만드는 설계라 0157 이후 인증 endpoint 에 도달할 수 없었고(활성 모듈 0개), 조인이 어긋나면
// 아무 로그 없이 사용량이 멈췄다.
//
// 이제 경로는 하나다: **`Provider.usage` 를 선언한 provider 를 그대로 호출**한다. 호출 대상이
// 선언 주체라 `sourceId` 조인이 없고, 팬아웃(`UsageFeed`)·표본 dedupe 도 필요가 없어졌다 —
// 한 spec 이 정확히 한 번 호출한다.
export class ExternalUsageService {
  private readonly inFlight = new Map<string, Promise<ExternalUsageReport | null>>()
  private readonly store = new Map<string, Map<string, unknown>>()
  // 마지막 fetch 가 성공한(fresh) providerKey 집합(in-memory). 실패 시 제거되어 캐시 baseline
  // 을 stale 로 쓰고, 재성공 시 다시 담겨 권위값이 복구된다(0111). 재시작 직후 첫 성공 전까지는
  // 미포함 = stale.
  private readonly freshProviderKeys = new Set<string>()
  private readonly clock: () => number
  private readonly logger: (message: string, meta?: Record<string, unknown>) => void

  constructor(private readonly deps: ServiceDeps) {
    this.clock = deps.clock ?? Date.now
    this.logger =
      deps.logger ??
      ((message, meta) =>
        getLogger()
          .child('usage')
          .warn('usage.external.warning', { message, ...(meta !== undefined ? { meta } : {}) }))
  }

  private specFor(providerKey: string): UsageSpecEntry | undefined {
    return this.deps.specs().find((entry) => entry.providerKey === providerKey)
  }

  hasProvider(providerKey: string): boolean {
    return this.specFor(providerKey) !== undefined
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
    const entry = this.specFor(providerKey)
    if (!entry) return this.readCachedReport(providerKey)
    const existing = this.inFlight.get(providerKey)
    if (existing) return existing
    const promise = this.fetchAndPersist(entry).finally(() => this.inFlight.delete(providerKey))
    this.inFlight.set(providerKey, promise)
    return promise
  }

  // cron 1틱. **인자를 주면 그중 spec 이 있는 것만** 돈다(설정 디렉토리 열거와의 교집합).
  async refreshAll(providerKeys?: readonly string[]): Promise<void> {
    const declared = this.deps.specs().map((entry) => entry.providerKey)
    const keys = providerKeys?.filter((key) => declared.includes(key)) ?? declared
    // **걸러진 키를 침묵시키지 않는다** — 구 구조에서 조인 오타가 아무 신호 없이 사용량을
    // 멈춘 지점이 정확히 여기다(0183).
    const unmatched = declared.filter(
      (key) => providerKeys !== undefined && !providerKeys.includes(key)
    )
    for (const providerKey of unmatched) {
      this.logger('usage spec 의 providerKey 가 provider settings 열거에 없다', { providerKey })
    }
    await Promise.all(keys.map((key) => this.refresh(key)))
  }

  private async fetchAndPersist(entry: UsageSpecEntry): Promise<ExternalUsageReport | null> {
    const sources = this.deps.sources
    if (!sources) {
      this.logger('usage source port is not wired — keeping cached baseline', {
        providerKey: entry.providerKey
      })
      return this.staleBaseline(entry.providerKey)
    }

    const request: UsageSampleRequest = {
      operation: entry.spec.operation,
      ...(entry.spec.params ? { params: entry.spec.params } : {})
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    try {
      const outcome = await sources.invoke(entry.providerId, request, controller.signal)
      if (!outcome.ok) {
        // 미인증(`not_connected`)은 **정상 상태다** — 부팅 직후·사내망 밖·로그아웃 후.
        this.logger('usage source invoke failed', {
          providerKey: entry.providerKey,
          providerId: entry.providerId,
          operation: request.operation,
          reason: outcome.reason,
          ...(outcome.message !== undefined ? { message: outcome.message } : {})
        })
        return this.staleBaseline(entry.providerKey)
      }

      const mapped = entry.spec.map(outcome.sample, {
        providerKey: entry.providerKey,
        store: this.providerStore(entry.providerKey),
        logger: this.logger,
        clock: this.clock
      })
      // `null` 은 "이 표본은 내 것이 아니다/형식이 다르다" 이며 정상 경로다 — baseline 유지.
      if (!mapped) return this.staleBaseline(entry.providerKey)

      // providerKey 는 **선언에서 파생된 것으로 고정**한다. map 이 남의 키를 적어도 그 행을 못 덮는다.
      const report: ExternalUsageReport = { ...mapped, providerKey: entry.providerKey }
      this.persist(report)
      this.freshProviderKeys.add(entry.providerKey)
      return report
    } catch (err) {
      this.logger('fetch failed — using cached baseline', {
        providerKey: entry.providerKey,
        err: String(err)
      })
      return this.staleBaseline(entry.providerKey)
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
