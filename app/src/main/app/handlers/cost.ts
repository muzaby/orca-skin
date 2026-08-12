// 사용량 IPC 4종 — 정본 조회 · 원격 즉시 동기화 · provider 월 한도 설정 · 사용량 통계
// (0179 에서 misc 에서 분리, 0183 r2 에서 외부 리포트 새로고침 제거, **0186 에서 정본을 Main 으로**).
//
// 0186 — renderer 가 주/월 한도를 재계산하던 구조를 접었다. Main 이 `UsageLimitsView` 를 완성해
// 돌려주고 renderer 는 mirror 만 한다. 그 결과 채널 2개가 하나로 흡수됐다:
//   cost:summary          ─┐
//   cost:providerSummaries ┴─► cost:usage        (providerKey 유무로 갈린다)
//   cost:summaryEvent        ─► cost:usageEvent  (변경된 scope 만 push)
//
// 상세 stats(7d/30d/all·일별·모델별)는 합치지 않는다 — Composer 가 쓰지 않고 설정 화면을 열 때만
// 필요한 lazy 조회라, headline 상태에 상주시키면 매 턴 불필요한 데이터가 흐른다.

import {
  CHANNELS,
  RefreshUsageSchema,
  SetProviderLimitSchema,
  UsageRequestSchema,
  UsageStatsRequestSchema,
  type UsageStats
} from '../../../shared/protocol'
import type { UsageLimitsView } from '../../../shared/usage/limits'
import { handle } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'

export function registerCostHandlers(ctx: RouterContext): void {
  // 정본 조회 — providerKey 가 있으면 provider 뷰(원격 기준선 합성 포함), 없으면 전역.
  // 조회류라 실패 정책은 fallback: null — renderer 는 null 이면 한도 섹션을 숨긴다(기존 동작).
  handle(
    CHANNELS.costUsage,
    UsageRequestSchema,
    { fallback: null as UsageLimitsView | null },
    (req): UsageLimitsView =>
      req.providerKey ? ctx.cost.getProviderUsage(req.providerKey) : ctx.cost.getGlobalUsage()
  )

  // 원격 즉시 동기화 — 설정 사용량 탭의 동기화 버튼. **1분 cron 을 기다리지 않는다.**
  //
  // 조회 채널(`cost:usage`)에 `refresh:true` 같은 옵션을 얹지 않고 채널을 나눈 이유: 원격 호출 +
  // 0014 캐시 쓰기는 부수효과이고, 이 저장소의 실패 정책은 읽기=fallback·쓰기=reject 로 갈린다.
  // 한 채널이 두 정책을 가질 수 없다.
  //
  // fetcher 미주입/미지원 배포에서는 `refreshProvider` 가 null 이라 로컬 재조회가 된다 —
  // 버튼이 죽지 않고 자연히 성능이 떨어진다(graceful degradation).
  handle(
    CHANNELS.costRefreshUsage,
    RefreshUsageSchema,
    'reject',
    async (req): Promise<UsageLimitsView> => {
      return (
        (await ctx.cost.refreshProvider(req.providerKey)) ??
        ctx.cost.getProviderUsage(req.providerKey)
      )
    }
  )

  // provider별 월 한도 설정 — 저장 후 갱신된 뷰를 되돌려준다(즉시 반영). 쓰기라 'reject'.
  handle(
    CHANNELS.costSetProviderLimit,
    SetProviderLimitSchema,
    'reject',
    (req): UsageLimitsView => {
      ctx.db.setProviderLimit(req.providerKey, req.limitUsd, Date.now())
      return ctx.cost.getProviderUsage(req.providerKey)
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
