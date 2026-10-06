import type Database from 'better-sqlite3'
import type {
  DailyUsageRow,
  ModelUsageSumRow,
  TurnModelUsageInsert,
  TurnModelUsageRow,
  TurnUsageInsert,
  TurnUsageRow,
  UsageBreakdown,
  ProviderPeriodCosts,
  ProviderUsagePeriodRow,
  ProviderUsagePeriodModelRow,
  UsagePeriodFilter,
  ProviderDailyUsageRow,
  ProviderDayModelUsageRow,
  ProviderUsageReportRow,
  ProviderUsageReportUpsert,
  UsageByBoundaries,
  UsageSumRow
} from './types'

// 같은 DB 연결의 사용량 원장 접근. statement 준비 시점은 기존 쿼리와 동일하다.
export class UsageQueries {
  // per-turn 사용량 원장 — insert(턴 종료) + 세션 최신 행 조회(컨텍스트 도넛/패널 복원).
  private readonly insertTurnUsageStmt: Database.Statement
  private readonly insertTurnModelUsageStmt: Database.Statement
  private readonly getLatestTurnUsageStmt: Database.Statement
  private readonly sumSessionCostUsdStmt: Database.Statement
  private readonly listTurnModelUsageStmt: Database.Statement
  private readonly sumUsageByBoundariesStmt: Database.Statement
  // provider별(0080) — turn_usage ⨝ sessions(provider_key)로 provider 한정 집계 + 한도 원장.
  private readonly sumUsageByBoundariesForProviderStmt: Database.Statement
  // 사용량 요약(0112) — 설정 모달 열림 시에만 필요해 lazy prepare(부팅 비용 회피, schedule* 선례).
  private sumUsageByDaySinceStmt?: Database.Statement
  private sumUsageByModelSinceStmt?: Database.Statement
  private readonly getProviderLimitStmt: Database.Statement
  private readonly setProviderLimitStmt: Database.Statement
  // 원격 사용량 스냅샷(0014) — provider 당 1행. fetcher 가 있는 배포에서만 쓰이므로 lazy prepare.
  private getProviderUsageReportStmt?: Database.Statement
  private upsertProviderUsageReportStmt?: Database.Statement
  private upsertPeriodStmt?: Database.Statement
  private deletePeriodModelsStmt?: Database.Statement
  private insertPeriodModelStmt?: Database.Statement
  private periodCostsStmt?: Database.Statement
  private listPeriodsStmt?: Database.Statement
  private listPeriodModelsStmt?: Database.Statement
  private sumDayForProviderStmt?: Database.Statement
  private sumProviderDayStmt?: Database.Statement
  private sumProviderDayModelStmt?: Database.Statement

  constructor(private readonly db: Database.Database) {
    this.insertTurnUsageStmt = db.prepare(`
      INSERT INTO turn_usage
        (session_id, message_id, created_at, input_tokens, output_tokens,
         cache_creation_input_tokens, cache_read_input_tokens, total_cost_usd)
      VALUES
        (@sessionId, @messageId, @createdAt, @inputTokens, @outputTokens,
         @cacheCreationInputTokens, @cacheReadInputTokens, @totalCostUsd)
    `)
    this.insertTurnModelUsageStmt = db.prepare(`
      INSERT INTO turn_model_usage
        (turn_usage_id, model, input_tokens, output_tokens,
         cache_creation_input_tokens, cache_read_input_tokens, cost_usd, context_window)
      VALUES
        (@turnUsageId, @model, @inputTokens, @outputTokens,
         @cacheCreationInputTokens, @cacheReadInputTokens, @costUsd, @contextWindow)
    `)
    // 세션의 마지막 턴 사용량 — 컨텍스트 도넛/패널을 세션 로드 시 복원.
    this.getLatestTurnUsageStmt = db.prepare(`
      SELECT * FROM turn_usage WHERE session_id = @sessionId ORDER BY created_at DESC, id DESC LIMIT 1
    `)
    // 세션 한정 비용 총합(0122 r2) — 상태 팝오버 "이 세션에서 사용한 비용" 복원용.
    this.sumSessionCostUsdStmt = db.prepare(`
      SELECT COALESCE(SUM(total_cost_usd), 0) AS total FROM turn_usage WHERE session_id = @sessionId
    `)
    this.listTurnModelUsageStmt = db.prepare(`
      SELECT * FROM turn_model_usage
      WHERE turn_usage_id = @turnUsageId
      ORDER BY COALESCE(input_tokens, 0) DESC, id ASC
    `)
    // 1일/주/월 합산을 한 번의 스캔으로 — dayStart ≥ weekStart ≥ monthStart 이므로 monthStart
    // 이후 행만 훑고 구간별 조건부 SUM 으로 3구간 × 5지표를 동시 집계한다(구 sumUsageSince 3회 대체).
    this.sumUsageByBoundariesStmt = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= @dayStart THEN input_tokens END), 0) AS day_input_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @dayStart THEN output_tokens END), 0) AS day_output_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @dayStart THEN cache_creation_input_tokens END), 0) AS day_cache_creation_input_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @dayStart THEN cache_read_input_tokens END), 0) AS day_cache_read_input_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @dayStart THEN total_cost_usd END), 0) AS day_total_cost_usd,
        COALESCE(SUM(CASE WHEN created_at >= @weekStart THEN input_tokens END), 0) AS week_input_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @weekStart THEN output_tokens END), 0) AS week_output_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @weekStart THEN cache_creation_input_tokens END), 0) AS week_cache_creation_input_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @weekStart THEN cache_read_input_tokens END), 0) AS week_cache_read_input_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @weekStart THEN total_cost_usd END), 0) AS week_total_cost_usd,
        COALESCE(SUM(input_tokens), 0) AS month_input_tokens,
        COALESCE(SUM(output_tokens), 0) AS month_output_tokens,
        COALESCE(SUM(cache_creation_input_tokens), 0) AS month_cache_creation_input_tokens,
        COALESCE(SUM(cache_read_input_tokens), 0) AS month_cache_read_input_tokens,
        COALESCE(SUM(total_cost_usd), 0) AS month_total_cost_usd
      FROM turn_usage
      WHERE created_at >= @monthStart
    `)
    // provider 한정 집계 — sumUsageByBoundaries 동형이나 sessions.provider_key 로 조인·필터한다.
    // session 삭제 시 turn_usage.session_id 가 NULL 이 되므로 INNER JOIN 이 그 행을 자연히 제외한다.
    this.sumUsageByBoundariesForProviderStmt = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tu.created_at >= @dayStart THEN tu.input_tokens END), 0) AS day_input_tokens,
        COALESCE(SUM(CASE WHEN tu.created_at >= @dayStart THEN tu.output_tokens END), 0) AS day_output_tokens,
        COALESCE(SUM(CASE WHEN tu.created_at >= @dayStart THEN tu.cache_creation_input_tokens END), 0) AS day_cache_creation_input_tokens,
        COALESCE(SUM(CASE WHEN tu.created_at >= @dayStart THEN tu.cache_read_input_tokens END), 0) AS day_cache_read_input_tokens,
        COALESCE(SUM(CASE WHEN tu.created_at >= @dayStart THEN tu.total_cost_usd END), 0) AS day_total_cost_usd,
        COALESCE(SUM(CASE WHEN tu.created_at >= @weekStart THEN tu.input_tokens END), 0) AS week_input_tokens,
        COALESCE(SUM(CASE WHEN tu.created_at >= @weekStart THEN tu.output_tokens END), 0) AS week_output_tokens,
        COALESCE(SUM(CASE WHEN tu.created_at >= @weekStart THEN tu.cache_creation_input_tokens END), 0) AS week_cache_creation_input_tokens,
        COALESCE(SUM(CASE WHEN tu.created_at >= @weekStart THEN tu.cache_read_input_tokens END), 0) AS week_cache_read_input_tokens,
        COALESCE(SUM(CASE WHEN tu.created_at >= @weekStart THEN tu.total_cost_usd END), 0) AS week_total_cost_usd,
        COALESCE(SUM(tu.input_tokens), 0) AS month_input_tokens,
        COALESCE(SUM(tu.output_tokens), 0) AS month_output_tokens,
        COALESCE(SUM(tu.cache_creation_input_tokens), 0) AS month_cache_creation_input_tokens,
        COALESCE(SUM(tu.cache_read_input_tokens), 0) AS month_cache_read_input_tokens,
        COALESCE(SUM(tu.total_cost_usd), 0) AS month_total_cost_usd
      FROM turn_usage tu
      JOIN sessions s ON s.id = tu.session_id
      WHERE tu.created_at >= @monthStart AND s.provider_key = @providerKey
    `)
    this.getProviderLimitStmt = db.prepare(`
      SELECT limit_usd FROM provider_limits WHERE provider_key = @providerKey
    `)
    // upsert — 같은 provider_key 재설정 시 limit_usd/updated_at 갱신.
    this.setProviderLimitStmt = db.prepare(`
      INSERT INTO provider_limits (provider_key, limit_usd, updated_at)
      VALUES (@providerKey, @limitUsd, @updatedAt)
      ON CONFLICT(provider_key) DO UPDATE SET limit_usd = @limitUsd, updated_at = @updatedAt
    `)
  }

  // 턴 종료 시 turn_usage 부모 1행 적재. 반환 id 로 turn_model_usage 자식을 연결한다.
  insertTurnUsage(row: TurnUsageInsert): number {
    const info = this.insertTurnUsageStmt.run(row)
    return Number(info.lastInsertRowid)
  }

  insertTurnModelUsage(row: TurnModelUsageInsert): void {
    this.insertTurnModelUsageStmt.run(row)
  }

  // 세션의 마지막 턴 사용량 행(없으면 undefined). 컨텍스트 도넛/패널 복원용.
  getLatestTurnUsage(
    sessionId: string
  ): { turn: TurnUsageRow; modelUsage: TurnModelUsageRow[] } | undefined {
    const turn = this.getLatestTurnUsageStmt.get({ sessionId }) as TurnUsageRow | undefined
    if (!turn) return undefined
    const modelUsage = this.listTurnModelUsageStmt.all({
      turnUsageId: turn.id
    }) as TurnModelUsageRow[]
    return { turn, modelUsage }
  }

  // 세션 한정 비용 총합(0122 r2). 원장 행이 없으면 0.
  sumSessionCostUsd(sessionId: string): number {
    const r = this.sumSessionCostUsdStmt.get({ sessionId }) as { total: number }
    return r.total
  }

  sumUsageByBoundaries(b: {
    dayStart: number
    weekStart: number
    monthStart: number
  }): UsageByBoundaries {
    const r = this.sumUsageByBoundariesStmt.get(b) as Record<string, number>
    const period = (prefix: 'day' | 'week' | 'month'): UsageSumRow => ({
      input_tokens: r[`${prefix}_input_tokens`],
      output_tokens: r[`${prefix}_output_tokens`],
      cache_creation_input_tokens: r[`${prefix}_cache_creation_input_tokens`],
      cache_read_input_tokens: r[`${prefix}_cache_read_input_tokens`],
      total_cost_usd: r[`${prefix}_total_cost_usd`]
    })
    return { day: period('day'), week: period('week'), month: period('month') }
  }

  // provider 한정 집계(0080) — sumUsageByBoundaries 와 같은 형태를 provider_key 로 필터해 반환.
  sumUsageByBoundariesForProvider(
    providerKey: string,
    b: { dayStart: number; weekStart: number; monthStart: number }
  ): UsageByBoundaries {
    const r = this.sumUsageByBoundariesForProviderStmt.get({ ...b, providerKey }) as Record<
      string,
      number
    >
    const period = (prefix: 'day' | 'week' | 'month'): UsageSumRow => ({
      input_tokens: r[`${prefix}_input_tokens`],
      output_tokens: r[`${prefix}_output_tokens`],
      cache_creation_input_tokens: r[`${prefix}_cache_creation_input_tokens`],
      cache_read_input_tokens: r[`${prefix}_cache_read_input_tokens`],
      total_cost_usd: r[`${prefix}_total_cost_usd`]
    })
    return {
      day: period('day'),
      week: period('week'),
      month: period('month')
    }
  }

  // 원격 사용량 스냅샷 — provider 당 최신 1행(마이그레이션 0014). 0183 r2 가 접근자를 지웠고
  // 0186 이 생산자(cron `usage-fetch`)와 **한 세트로** 되살린다. 테이블·스키마는 그대로다.
  getProviderUsageReport(providerKey: string): ProviderUsageReportRow | undefined {
    this.getProviderUsageReportStmt ??= this.db.prepare(`
      SELECT provider_key, report_json, fetched_at, as_of,
             quota_limit_usd, quota_used_usd, quota_remaining_usd, updated_at
      FROM provider_usage_report_cache WHERE provider_key = @providerKey
    `)
    return this.getProviderUsageReportStmt.get({ providerKey }) as
      ProviderUsageReportRow | undefined
  }

  upsertProviderUsageReport(row: ProviderUsageReportUpsert): void {
    this.upsertProviderUsageReportStmt ??= this.db.prepare(`
      INSERT INTO provider_usage_report_cache (
        provider_key, report_json, fetched_at, as_of,
        quota_limit_usd, quota_used_usd, quota_remaining_usd, updated_at
      ) VALUES (
        @providerKey, @reportJson, @fetchedAt, @asOf,
        @quotaLimitUsd, @quotaUsedUsd, @quotaRemainingUsd, @updatedAt
      )
      ON CONFLICT(provider_key) DO UPDATE SET
        report_json = @reportJson,
        fetched_at = @fetchedAt,
        as_of = @asOf,
        quota_limit_usd = @quotaLimitUsd,
        quota_used_usd = @quotaUsedUsd,
        quota_remaining_usd = @quotaRemainingUsd,
        updated_at = @updatedAt
    `)
    this.upsertProviderUsageReportStmt.run(row)
  }

  // 모든 원격 쓰기는 같은 SQLite 트랜잭션에 속한다. 모델 집합은 보고한 기간만 교체한다.
  saveProviderUsageReport(report: ProviderUsageReportUpsert, periods: UsageBreakdown): void {
    this.upsertPeriodStmt ??= this.db.prepare(`
      INSERT INTO provider_usage_periods (provider_key, period_kind, period, input_tokens,
        output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cost_usd, fetched_at, updated_at)
      VALUES (@providerKey, @kind, @period, @inputTokens, @outputTokens, @cacheCreationInputTokens,
        @cacheReadInputTokens, @costUsd, @fetchedAt, @updatedAt)
      ON CONFLICT(provider_key, period_kind, period) DO UPDATE SET
        input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
        cache_creation_input_tokens = excluded.cache_creation_input_tokens,
        cache_read_input_tokens = excluded.cache_read_input_tokens, cost_usd = excluded.cost_usd,
        fetched_at = excluded.fetched_at, updated_at = excluded.updated_at
    `)
    this.deletePeriodModelsStmt ??= this.db.prepare(`
      DELETE FROM provider_usage_period_models
      WHERE provider_key = @providerKey AND period_kind = @kind AND period = @period
    `)
    this.insertPeriodModelStmt ??= this.db.prepare(`
      INSERT INTO provider_usage_period_models (provider_key, period_kind, period, model, input_tokens,
        output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cost_usd, fetched_at, updated_at)
      VALUES (@providerKey, @kind, @period, @model, @inputTokens, @outputTokens,
        @cacheCreationInputTokens, @cacheReadInputTokens, @costUsd, @fetchedAt, @updatedAt)
    `)
    this.db.transaction(() => {
      this.upsertProviderUsageReport(report)
      const meta = {
        providerKey: report.providerKey,
        fetchedAt: report.fetchedAt,
        updatedAt: report.updatedAt
      }
      for (const total of periods.totals) this.upsertPeriodStmt!.run({ ...meta, ...total })
      for (const set of periods.modelSets) {
        this.deletePeriodModelsStmt!.run({
          providerKey: report.providerKey,
          kind: set.kind,
          period: set.period
        })
        for (const model of set.models) {
          this.insertPeriodModelStmt!.run({ ...meta, kind: set.kind, period: set.period, ...model })
        }
      }
    })()
  }

  providerPeriodCosts(
    providerKey: string,
    window: { fromDay: string; toDay: string; month: string }
  ): ProviderPeriodCosts {
    this.periodCostsStmt ??= this.db.prepare(`
      SELECT period_kind, period, cost_usd FROM provider_usage_periods WHERE provider_key = @providerKey
        AND ((period_kind = 'day' AND period >= @fromDay AND period <= @toDay)
          OR (period_kind = 'month' AND period = @month)) ORDER BY period
    `)
    const rows = this.periodCostsStmt.all({ providerKey, ...window }) as Pick<
      ProviderUsagePeriodRow,
      'period_kind' | 'period' | 'cost_usd'
    >[]
    return {
      days: rows
        .filter((r) => r.period_kind === 'day')
        .map((r) => ({ day: r.period, costUsd: r.cost_usd })),
      month: rows.find((r) => r.period_kind === 'month')
        ? { costUsd: rows.find((r) => r.period_kind === 'month')!.cost_usd }
        : null
    }
  }

  listProviderUsagePeriods(filter: UsagePeriodFilter): ProviderUsagePeriodRow[] {
    this.listPeriodsStmt ??= this.db.prepare(`
      SELECT * FROM provider_usage_periods WHERE period_kind = @periodKind
        AND (@from IS NULL OR period >= @from) AND (@to IS NULL OR period <= @to)
      ORDER BY period, provider_key
    `)
    return this.listPeriodsStmt.all({
      ...filter,
      from: filter.from ?? null,
      to: filter.to ?? null
    }) as ProviderUsagePeriodRow[]
  }

  listProviderUsagePeriodModels(filter: UsagePeriodFilter): ProviderUsagePeriodModelRow[] {
    this.listPeriodModelsStmt ??= this.db.prepare(`
      SELECT * FROM provider_usage_period_models WHERE period_kind = @periodKind
        AND (@from IS NULL OR period >= @from) AND (@to IS NULL OR period <= @to)
      ORDER BY period, provider_key, model
    `)
    return this.listPeriodModelsStmt.all({
      ...filter,
      from: filter.from ?? null,
      to: filter.to ?? null
    }) as ProviderUsagePeriodModelRow[]
  }

  sumUsageByDayForProvider(providerKey: string, since: number): DailyUsageRow[] {
    this.sumDayForProviderStmt ??= this.db.prepare(`
      SELECT date(tu.created_at / 1000, 'unixepoch', 'localtime') AS day,
        ${localMetricsSql('tu', 'total_cost_usd')}
      FROM turn_usage tu JOIN sessions s ON s.id = tu.session_id
      WHERE tu.created_at >= @since AND s.provider_key = @providerKey GROUP BY day ORDER BY day
    `)
    return this.sumDayForProviderStmt.all({ providerKey, since }) as DailyUsageRow[]
  }

  sumUsageByProviderDaySince(since: number): ProviderDailyUsageRow[] {
    this.sumProviderDayStmt ??= this.db.prepare(`
      SELECT s.provider_key, date(tu.created_at / 1000, 'unixepoch', 'localtime') AS day,
        ${localMetricsSql('tu', 'total_cost_usd')}
      FROM turn_usage tu LEFT JOIN sessions s ON s.id = tu.session_id
      WHERE tu.created_at >= @since GROUP BY s.provider_key, day ORDER BY day, s.provider_key
    `)
    return this.sumProviderDayStmt.all({ since }) as ProviderDailyUsageRow[]
  }

  sumModelUsageByProviderDaySince(since: number): ProviderDayModelUsageRow[] {
    this.sumProviderDayModelStmt ??= this.db.prepare(`
      SELECT s.provider_key, date(tu.created_at / 1000, 'unixepoch', 'localtime') AS day, tmu.model,
        ${localMetricsSql('tmu', 'cost_usd')}
      FROM turn_model_usage tmu JOIN turn_usage tu ON tu.id = tmu.turn_usage_id
      LEFT JOIN sessions s ON s.id = tu.session_id
      WHERE tu.created_at >= @since GROUP BY s.provider_key, day, tmu.model ORDER BY day, s.provider_key, tmu.model
    `)
    return this.sumProviderDayModelStmt.all({ since }) as ProviderDayModelUsageRow[]
  }

  // 사용량 요약(0112) — since(epoch ms, 'all'=0) 이후를 OS 로컬 일자로 버킷팅해 합산한다.
  // date(...,'localtime') 은 renderer 의 localDayKey(shared/usage/stats.ts)와 같은 OS 타임존을
  // 쓰므로 키 포맷('YYYY-MM-DD')이 일치한다. created_at/1000 은 SQLite 정수 나눗셈(절삭).
  sumUsageByDaySince(since: number): DailyUsageRow[] {
    this.sumUsageByDaySinceStmt ??= this.db.prepare(`
      SELECT
        date(created_at / 1000, 'unixepoch', 'localtime') AS day,
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COALESCE(SUM(cache_creation_input_tokens), 0) AS cache_creation_input_tokens,
        COALESCE(SUM(cache_read_input_tokens), 0) AS cache_read_input_tokens,
        COALESCE(SUM(total_cost_usd), 0) AS total_cost_usd
      FROM turn_usage
      WHERE created_at >= @since
      GROUP BY day
      ORDER BY day ASC
    `)
    return this.sumUsageByDaySinceStmt.all({ since }) as DailyUsageRow[]
  }

  // 사용량 요약(0112) — since 이후 모델별 합산(총 토큰 내림차순). 부모 turn_usage 와 조인해
  // created_at 필터를 공유한다(자식 행에는 시각 컬럼이 없다).
  sumUsageByModelSince(since: number): ModelUsageSumRow[] {
    this.sumUsageByModelSinceStmt ??= this.db.prepare(`
      SELECT
        tmu.model AS model,
        COALESCE(SUM(tmu.input_tokens), 0) AS input_tokens,
        COALESCE(SUM(tmu.output_tokens), 0) AS output_tokens,
        COALESCE(SUM(tmu.cache_creation_input_tokens), 0) AS cache_creation_input_tokens,
        COALESCE(SUM(tmu.cache_read_input_tokens), 0) AS cache_read_input_tokens,
        COALESCE(SUM(tmu.cost_usd), 0) AS cost_usd
      FROM turn_model_usage tmu
      JOIN turn_usage tu ON tu.id = tmu.turn_usage_id
      WHERE tu.created_at >= @since
      GROUP BY tmu.model
      ORDER BY (COALESCE(SUM(tmu.input_tokens), 0) + COALESCE(SUM(tmu.output_tokens), 0)
        + COALESCE(SUM(tmu.cache_creation_input_tokens), 0)
        + COALESCE(SUM(tmu.cache_read_input_tokens), 0)) DESC, tmu.model ASC
    `)
    return this.sumUsageByModelSinceStmt.all({ since }) as ModelUsageSumRow[]
  }

  // provider별 월 한도 조회 — 행 부재/NULL 이면 null(무제한 또는 미설정).
  getProviderLimit(providerKey: string): number | null {
    const row = this.getProviderLimitStmt.get({ providerKey }) as
      { limit_usd: number | null } | undefined
    return row?.limit_usd ?? null
  }

  setProviderLimit(providerKey: string, limitUsd: number | null, updatedAt: number): void {
    this.setProviderLimitStmt.run({ providerKey, limitUsd, updatedAt })
  }
}

function localMetricsSql(alias: string, cost: 'cost_usd' | 'total_cost_usd'): string {
  return [
    'input_tokens',
    'output_tokens',
    'cache_creation_input_tokens',
    'cache_read_input_tokens',
    cost
  ]
    .map((key) => `COALESCE(SUM(${alias}.${key}), 0) AS ${key}`)
    .join(', ')
}
