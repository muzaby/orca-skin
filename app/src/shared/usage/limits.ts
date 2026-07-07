// 사용량 한도 파생 — 실사용량 SSOT(main UsageTracker → renderer costStore 의 CostSummary)와
// 월 지출 한도(설정)를 받아 주간/월간 프로그레스바 뷰모델을 만든다. **유일한 계산 지점**:
// 설정 화면과 도넛 팝오버 둘 다 이 순수 함수만 호출하고 각자 재계산하지 않는다(SSOT 요구).
// 통화는 추정 비용(totalCostUsd, 청구 권위 아님 — 폴백)이다.

import type { CostSummary } from '../ipc'
import { monthDaysLeft, weekDaysLeft } from '../time/clock'
import { monthResetLabel, weekResetLabel } from '../time/resetLabels'

export interface UsageLimitBar {
  used: number // USD, 해당 기간 실사용
  budget: number | null // USD, 기간 예산 envelope (무제한이면 null)
  pct: number // 0..1, used/budget 클램프
  resetLabel: string
  unlimited: boolean
}

export interface UsageLimitsView {
  week: UsageLimitBar
  month: UsageLimitBar
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0
  return x > 1 ? 1 : x
}

// 주간 예산(사용자 제안 공식 완성):
//   perDay = 남은 월 한도 / 이달 남은 일수(오늘 포함)
//   weekRemainingBudget = perDay * 이번 주 남은 일수(오늘~일요일)
//   weekBudget = 이번 주 실사용 + weekRemainingBudget   (이번 주 유효 envelope)
//   weekPct = 이번 주 실사용 / weekBudget
// 월간: monthPct = 이달 실사용 / 월 한도.
export function computeUsageLimits(
  summary: CostSummary,
  limitUsd: number | null,
  now: number | Date = Date.now()
): UsageLimitsView {
  const mUsed = summary.month.totalCostUsd
  const wUsed = summary.week.totalCostUsd
  const weekReset = weekResetLabel(now)
  const monthReset = monthResetLabel(now)

  // 무제한(한도 미설정) — 예산·퍼센트 없이 사용액만 노출.
  if (limitUsd == null || limitUsd <= 0) {
    return {
      week: { used: wUsed, budget: null, pct: 0, resetLabel: weekReset, unlimited: true },
      month: { used: mUsed, budget: null, pct: 0, resetLabel: monthReset, unlimited: true }
    }
  }

  const remainingLimit = Math.max(0, limitUsd - mUsed)
  const daysLeftInMonth = monthDaysLeft(now)
  const perDay = daysLeftInMonth > 0 ? remainingLimit / daysLeftInMonth : 0
  const weekRemainingBudget = perDay * weekDaysLeft(now)
  const weekBudget = wUsed + weekRemainingBudget

  return {
    week: {
      used: wUsed,
      budget: weekBudget,
      pct: weekBudget > 0 ? clamp01(wUsed / weekBudget) : 0,
      resetLabel: weekReset,
      unlimited: false
    },
    month: {
      used: mUsed,
      budget: limitUsd,
      pct: clamp01(mUsed / limitUsd),
      resetLabel: monthReset,
      unlimited: false
    }
  }
}
