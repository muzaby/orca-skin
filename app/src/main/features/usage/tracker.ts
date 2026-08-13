// 사용량 집계 + **정본 조립** (0186) — 로컬 원장을 읽어 화면에 뜰 `UsageLimitsView` 를 여기서
// 완성한다. renderer 는 완성본을 mirror 만 하고 주/월을 재계산하지 않는다.
//
// **새 UsageService 클래스를 만들지 않는다** — 책임이 이 클래스의 것과 같다. 계층을 늘리는 대신
// 조회 2함수(getGlobalUsage·getProviderUsage)와 원격 갱신 1함수(refreshProvider)를 더한다.
//
// 성능 계약: 턴마다 **전 provider 를 재집계하지 않는다.** `recordAndBroadcast(providerKey)` 가
// 전역 1회 + 영향받은 provider 1회만 스캔하고 delta 이벤트를 낸다.

import type {
  CostPeriodSummary,
  CostSummary,
  UsageStats,
  UsageStatsRange
} from '../../../shared/ipc'
import { rangeSince } from '../../../shared/usage/stats'
import {
  computeUsageLimits,
  type UsageDelta,
  type UsageLimitsView
} from '../../../shared/usage/limits'
import type { DbQueries } from '../../infra/db'
import type { DailyUsageRow, ModelUsageSumRow, UsageSumRow } from '../../infra/db/types'
import { boundaries } from '../../../shared/time/clock'
import { composeProviderUsage } from './usage-compose'
import type { UsageFetcher, UsageSnapshot } from './fetcher'

export interface UsageTrackerDeps {
  // 전역 월 한도. Main SettingsStore 가 소유하고 메모리 캐시라 hot path 에서 disk read 가 없다.
  spendingLimitUsd: () => number | null
  // 원격 사용량 포트. **미주입은 정상 구성이다** — 그러면 원격 경로 자체가 실행되지 않는다.
  fetcher?: UsageFetcher
}

export class UsageTracker {
  private summary: CostSummary = emptySummary()

  // broadcast 는 컴포지션 루트(bootstrap)가 주입한다 — IPC 송출 배선을 분리해 이 클래스를
  // electron 비의존으로 유지한다(테스트 시 스파이로 검증 가능). 기본 no-op.
  constructor(
    private readonly db: DbQueries,
    private readonly broadcast: (delta: UsageDelta) => void = () => {},
    private readonly deps: UsageTrackerDeps = { spendingLimitUsd: () => null }
  ) {}

  recompute(now = Date.now()): CostSummary {
    const sums = this.db.sumUsageByBoundaries(boundaries(now))
    this.summary = {
      day: toPeriod(sums.day),
      week: toPeriod(sums.week),
      month: toPeriod(sums.month),
      updatedAt: now
    }
    return this.summary
  }

  // 턴 종료·경계 갱신의 단일 진입점. `providerKey` 가 있으면 그 **한 provider 만** 함께 갱신한다.
  recordAndBroadcast(providerKey?: string | null, now = Date.now()): void {
    this.recompute(now)
    this.broadcast({ scope: 'global', value: this.globalView(now) })
    if (providerKey) {
      this.broadcast({
        scope: 'provider',
        providerKey,
        value: this.getProviderUsage(providerKey, now)
      })
    }
  }

  // 기간 경계(자정) 갱신 — 전역을 다시 계산해 보내면서 **캐시된 provider 뷰 무효화**를 함께
  // 신호한다. `recordAndBroadcast()` 를 인자 없이 부르면 전역만 나가고, renderer 가 들고 있는
  // provider mirror 는 어제 기준(week/month/resetAt)에 그대로 멈춘다.
  //
  // 자정마다 전 provider 를 재집계하지 않는 이유는 `UsageDelta` 의 `boundary` 주석 참조.
  refreshBoundary(now = Date.now()): void {
    this.recompute(now)
    this.broadcast({ scope: 'boundary', value: this.globalView(now) })
  }

  getSummary(): CostSummary {
    return this.summary
  }

  // 전역 정본 — 원격을 보지 않는다(계정 단위 리포트는 provider 축에만 있다).
  getGlobalUsage(now = Date.now()): UsageLimitsView {
    this.recompute(now)
    return this.globalView(now)
  }

  // provider 정본 — 로컬 집계 + (있으면) 원격 기준선 + 한도를 합성한다.
  getProviderUsage(providerKey: string, now = Date.now()): UsageLimitsView {
    // DB cache 는 현재 capability 의 저장 수단일 뿐 그 자체가 authority 는 아니다. 배포가
    // provider 지원을 제거했으면 과거 행이 남아 있어도 local/configured 로 접는다.
    const snapshot = this.deps.fetcher?.supports(providerKey)
      ? this.readSnapshot(providerKey)
      : null
    // 기준선이 없으면 asOf 0 — delta 가 월 전체와 같아져 의미가 성립한다.
    const sums = this.db.sumUsageByBoundariesForProvider(
      providerKey,
      boundaries(now),
      snapshot?.asOf ?? 0
    )
    const local = {
      summary: {
        day: toPeriod(sums.day),
        week: toPeriod(sums.week),
        month: toPeriod(sums.month),
        updatedAt: now
      },
      monthDeltaCostUsd: sums.monthDeltaCostUsd
    }
    return composeProviderUsage(local, snapshot, this.db.getProviderLimit(providerKey), now)
  }

  // provider 월 한도 쓰기 — **한도는 이 뷰의 입력**(`budget`·`pct`)이므로 쓰기도 뷰의 주인이
  // 갖는다. IPC 핸들러가 `db.setProviderLimit` 을 직접 부르면 사용량 정본의 입력 중 하나만
  // authority 밖에 남는다(0186 이 정본을 Main 으로 모은 이유가 무색해진다).
  setProviderLimit(
    providerKey: string,
    limitUsd: number | null,
    now = Date.now()
  ): UsageLimitsView {
    this.db.setProviderLimit(providerKey, limitUsd, now)
    return this.getProviderUsage(providerKey, now)
  }

  // 원격 갱신 — 미지원이면 null. 성공 시 한 번 계산한 view 를 broadcast 와 caller 가 공유한다.
  // 실패 정책은 caller 소유다: manual command 는 reject, background cron 은 provider 를 격리하되
  // (한 provider 실패가 나머지를 막지 않는다) 틱 끝에서 실패를 승격한다 — `schedule_runs` 가
  // 성공으로 남으면 상시 실패를 확인할 경로가 사라진다.
  async refreshProvider(
    providerKey: string,
    signal?: AbortSignal
  ): Promise<UsageLimitsView | null> {
    if (!this.deps.fetcher?.supports(providerKey)) return null
    const snapshot = await this.deps.fetcher.fetchUsage(providerKey, signal)
    if (!snapshot) throw new Error(`Remote usage refresh returned no snapshot: ${providerKey}`)

    const now = Date.now()
    this.db.upsertProviderUsageReport({
      providerKey,
      // report_json 은 코어가 정한 봉투다 — 재시작 후에도 기준선 사용 가부를 알아야 한다.
      reportJson: JSON.stringify({
        baselineUsable: snapshot.baselineUsable === true,
        raw: snapshot.raw ?? null
      }),
      fetchedAt: snapshot.fetchedAt,
      asOf: snapshot.asOf,
      quotaLimitUsd: snapshot.limitUsd,
      quotaUsedUsd: snapshot.usedUsd,
      quotaRemainingUsd: snapshot.remainingUsd,
      updatedAt: now
    })
    const value = this.getProviderUsage(providerKey, now)
    this.broadcast({ scope: 'provider', providerKey, value })
    return value
  }

  // 사용량 요약(0112) — 기간별 일 단위 시계열 + 모델별 집계. providerSummary 처럼 캐시 없이
  // 요청 시 스캔한다(설정 사용량 탭 조회 시점에만 필요). days 는 희소(사용 있던 날만) —
  // 제로필은 renderer 몫. since=null 은 '전체'(하한 없음)를 뜻한다.
  usageStats(range: UsageStatsRange, now = Date.now()): UsageStats {
    const since = rangeSince(range, now)
    return {
      range,
      since: range === 'all' ? null : since,
      days: this.db.sumUsageByDaySince(since).map(toStatsDay),
      models: this.db.sumUsageByModelSince(since).map(toStatsModel),
      updatedAt: now
    }
  }

  private globalView(now: number): UsageLimitsView {
    return computeUsageLimits(this.summary, this.deps.spendingLimitUsd(), now)
  }

  // 0014 행 → UsageSnapshot. 봉투 파싱이 실패하면 `baselineUsable:false` 로 접는다(fail-closed) —
  // 알 수 없는 상태를 "기준선을 써도 된다" 로 읽지 않는다.
  private readSnapshot(providerKey: string): UsageSnapshot | null {
    const row = this.db.getProviderUsageReport(providerKey)
    if (!row) return null
    let baselineUsable = false
    let raw: unknown = null
    try {
      const envelope = JSON.parse(row.report_json) as { baselineUsable?: unknown; raw?: unknown }
      baselineUsable = envelope?.baselineUsable === true
      raw = envelope?.raw ?? null
    } catch {
      // 파싱 실패 = 알 수 없음 → 기준선 미사용.
    }
    return {
      providerKey: row.provider_key,
      asOf: row.as_of,
      fetchedAt: row.fetched_at,
      limitUsd: row.quota_limit_usd,
      usedUsd: row.quota_used_usd,
      remainingUsd: row.quota_remaining_usd,
      baselineUsable,
      raw
    }
  }
}

function toStatsDay(row: DailyUsageRow): UsageStats['days'][number] {
  return {
    day: row.day,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    totalCostUsd: row.total_cost_usd
  }
}

function toStatsModel(row: ModelUsageSumRow): UsageStats['models'][number] {
  return {
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    costUsd: row.cost_usd
  }
}

function toPeriod(row: UsageSumRow): CostPeriodSummary {
  return {
    totalCostUsd: row.total_cost_usd,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens
  }
}

function emptySummary(): CostSummary {
  const empty: CostPeriodSummary = {
    totalCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0
  }
  return { day: empty, week: empty, month: empty, updatedAt: 0 }
}
