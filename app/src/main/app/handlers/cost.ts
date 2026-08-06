// 사용량·비용 IPC 5종 — 요약·provider별 요약·외부 리포트 새로고침·월 한도 설정·사용량 통계
// (0179 에서 misc 에서 분리).

import {
  CHANNELS,
  ProviderSummariesRequestSchema,
  RefreshProviderUsageReportSchema,
  SetProviderLimitSchema,
  UsageStatsRequestSchema,
  type CostSummary,
  type ProviderUsageEntry,
  type UsageStats
} from '../../../shared/protocol'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'

export function registerCostHandlers(ctx: RouterContext): void {
  // 조회 시 DB 를 다시 스캔한다(recompute) — 설정 사용량의 수동 새로고침(동기화 버튼, 0080)이
  // 최신 값을 받도록. 단순 캐시 반환이 아니라 최신 집계를 반환한다(비용 단일 쿼리).
  handlePlain(CHANNELS.costSummary, (): CostSummary => ctx.cost.recompute())

  // provider별 사용량(0080 항목 4) — renderer 가 전달한 provider key 마다 실사용 summary(turn_usage
  // ⨝ sessions.provider_key)와 월 한도(provider_limits)를 묶어 반환. 미설정 한도는 null.
  handle(
    CHANNELS.costProviderSummaries,
    ProviderSummariesRequestSchema,
    { fallback: [] as ProviderUsageEntry[] },
    (req): ProviderUsageEntry[] =>
      req.providerKeys.map((providerKey) =>
        ctx.externalUsage.entry(
          providerKey,
          ctx.cost.providerSummary(providerKey),
          ctx.db.getProviderLimit(providerKey)
        )
      )
  )

  handle(
    CHANNELS.costRefreshProviderUsageReport,
    RefreshProviderUsageReportSchema,
    'reject',
    async (req): Promise<ProviderUsageEntry> => {
      await ctx.externalUsage.refresh(req.providerKey)
      return ctx.externalUsage.entry(
        req.providerKey,
        ctx.cost.providerSummary(req.providerKey),
        ctx.db.getProviderLimit(req.providerKey)
      )
    }
  )

  // provider별 월 한도 설정 — 저장 후 갱신된 엔트리를 되돌려준다(즉시 반영).
  handle(
    CHANNELS.costSetProviderLimit,
    SetProviderLimitSchema,
    'reject',
    (req): ProviderUsageEntry => {
      ctx.db.setProviderLimit(req.providerKey, req.limitUsd, Date.now())
      return ctx.externalUsage.entry(
        req.providerKey,
        ctx.cost.providerSummary(req.providerKey),
        ctx.db.getProviderLimit(req.providerKey)
      )
    }
  )

  // 사용량 요약(0112) — 기간별 일 단위 시계열 + 모델별 집계. 조회류라 fallback 정책(빈 요약).
  handle(
    CHANNELS.costUsageStats,
    UsageStatsRequestSchema,
    { fallback: { range: '7d', since: null, days: [], models: [], updatedAt: 0 } as UsageStats },
    (req): UsageStats => ctx.cost.usageStats(req.range)
  )
}
