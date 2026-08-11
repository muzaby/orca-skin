// 사용량 한도 파생 — 실사용량 SSOT(main UsageTracker → renderer costStore 의 CostSummary)와
// 월 지출 한도(설정)를 받아 주간/월간 프로그레스바 뷰모델을 만든다. **유일한 계산 지점**:
// 설정 화면과 도넛 팝오버 둘 다 이 순수 함수만 호출하고 각자 재계산하지 않는다(SSOT 요구).
// 통화는 추정 비용(totalCostUsd, 청구 권위 아님 — 폴백)이다.

import type { CostSummary, ProviderUsageEntry } from '../ipc'
import { daysInMonth, weekDaysInMonth } from '../time/clock'
import { nextMonthReset, nextWeekReset } from '../time/reset'

export interface UsageLimitBar {
  used: number // USD, 해당 기간 실사용
  budget: number | null // USD, 기간 예산 envelope (무제한이면 null)
  pct: number // 0..1, used/budget 클램프
  period: 'week' | 'month'
  resetAt: number // epoch ms, 다음 재설정 시각 — 문장화는 renderer i18n(formatResetLabel)
  unlimited: boolean
}

export interface UsageLimitsView {
  week: UsageLimitBar
  month: UsageLimitBar
}

// provider 엔트리 → 한도 뷰모델(0098/0100). 설정 provider 서브탭·도넛 팝오버가 이 단일
// 투영만 호출한다(각자 재구현 금지).
//
// 0183 r2 — 외부 quota 를 권위값으로 삼던 정합(0111: external·fresh 스케일 / external·stale
// 바닥값)은 **리포트를 만드는 경로가 사라져** 도달할 수 없게 됐고 함께 제거했다. 지금은 로컬
// 집계와 월 한도만으로 파생한다. 되살릴 때는 리포트 생산자와 한 세트로 되살린다.
export function computeProviderUsageLimits(
  entry: ProviderUsageEntry,
  now: number | Date = Date.now()
): UsageLimitsView {
  return computeUsageLimits(entry.summary, entry.limitUsd, now)
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0
  return x > 1 ? 1 : x
}

// 주간 예산(고정 일할 — 0111, 구 런웨이 공식 대체):
//   perDay = 월 한도 / 이달 총 일수                        (한 달 내내 고정)
//   weekBudget = perDay * 이번 주 중 이달에 속한 일수       (경계 주는 이달 몫만)
//   weekPct = 이번 주 실사용 / weekBudget
// 사용량·경과일과 무관한 고정 envelope 라 weekPct 가 이번 주 실지출에만 반응한다.
// 월간: monthPct = 이달 실사용 / 월 한도.
export function computeUsageLimits(
  summary: CostSummary,
  limitUsd: number | null,
  now: number | Date = Date.now()
): UsageLimitsView {
  const mUsed = summary.month.totalCostUsd
  const wUsed = summary.week.totalCostUsd
  const week = { period: 'week', resetAt: nextWeekReset(now).getTime() } as const
  const month = { period: 'month', resetAt: nextMonthReset(now).getTime() } as const

  // 무제한(한도 미설정) — 예산·퍼센트 없이 사용액만 노출.
  if (limitUsd == null || limitUsd <= 0) {
    return {
      week: { ...week, used: wUsed, budget: null, pct: 0, unlimited: true },
      month: { ...month, used: mUsed, budget: null, pct: 0, unlimited: true }
    }
  }

  const totalDaysInMonth = daysInMonth(now)
  const perDay = totalDaysInMonth > 0 ? limitUsd / totalDaysInMonth : 0
  const weekBudget = perDay * weekDaysInMonth(now)

  return {
    week: {
      ...week,
      used: wUsed,
      budget: weekBudget,
      pct: weekBudget > 0 ? clamp01(wUsed / weekBudget) : 0,
      unlimited: false
    },
    month: {
      ...month,
      used: mUsed,
      budget: limitUsd,
      pct: clamp01(mUsed / limitUsd),
      unlimited: false
    }
  }
}
