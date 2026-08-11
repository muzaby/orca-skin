// 사용량·비용 IPC 4종 — 요약·provider별 요약·월 한도 설정·사용량 통계
// (0179 에서 misc 에서 분리, **0183 r2 에서 외부 리포트 새로고침 제거**).
//
// 0183 r2 — 원격 사용량 조회 경로를 전면 제거하면서 `cost:refreshProviderUsageReport` 도 함께
// 사라졌다. 엔트리는 이제 **로컬 값 셋**(실사용 summary · 월 한도)으로만 만들어진다. 사용량
// endpoint 를 부르는 배포가 생기면 그 기능을 쓰는 feature 가 `ProviderApi` 로 직접 부른다
// (절차: `docs/guides/closed-network-extensions.md` §5-b).

import {
  CHANNELS,
  ProviderSummariesRequestSchema,
  SetProviderLimitSchema,
  UsageStatsRequestSchema,
  type CostSummary,
  type ProviderUsageEntry,
  type UsageStats
} from '../../../shared/protocol'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'

export function registerCostHandlers(ctx: RouterContext): void {
  // provider별 엔트리 — 실사용 summary(turn_usage ⨝ sessions.provider_key)와 월 한도
  // (provider_limits)를 묶는다. 미설정 한도는 null.
  const entry = (providerKey: string): ProviderUsageEntry => ({
    providerKey,
    summary: ctx.cost.providerSummary(providerKey),
    limitUsd: ctx.db.getProviderLimit(providerKey)
  })

  // 조회 시 DB 를 다시 스캔한다(recompute) — 설정 사용량의 수동 새로고침(동기화 버튼, 0080)이
  // 최신 값을 받도록. 단순 캐시 반환이 아니라 최신 집계를 반환한다(비용 단일 쿼리).
  handlePlain(CHANNELS.costSummary, (): CostSummary => ctx.cost.recompute())

  // provider별 사용량(0080 항목 4) — renderer 가 전달한 provider key 마다 엔트리를 반환.
  // 동기화 버튼도 이 채널로 재조회한다(0183 r2 — 별도 새로고침 채널 없음).
  handle(
    CHANNELS.costProviderSummaries,
    ProviderSummariesRequestSchema,
    { fallback: [] as ProviderUsageEntry[] },
    (req): ProviderUsageEntry[] => req.providerKeys.map(entry)
  )

  // provider별 월 한도 설정 — 저장 후 갱신된 엔트리를 되돌려준다(즉시 반영).
  handle(
    CHANNELS.costSetProviderLimit,
    SetProviderLimitSchema,
    'reject',
    (req): ProviderUsageEntry => {
      ctx.db.setProviderLimit(req.providerKey, req.limitUsd, Date.now())
      return entry(req.providerKey)
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
