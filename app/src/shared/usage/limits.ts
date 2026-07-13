// 사용량 한도 파생 — 실사용량 SSOT(main UsageTracker → renderer costStore 의 CostSummary)와
// 월 지출 한도(설정)를 받아 주간/월간 프로그레스바 뷰모델을 만든다. **유일한 계산 지점**:
// 설정 화면과 도넛 팝오버 둘 다 이 순수 함수만 호출하고 각자 재계산하지 않는다(SSOT 요구).
// 통화는 추정 비용(totalCostUsd, 청구 권위 아님 — 폴백)이다.

import type { CostSummary, ProviderUsageEntry } from '../ipc'
import { monthDaysLeft, weekDaysLeft } from '../time/clock'
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

// provider 엔트리 → 한도 뷰모델(0098/0100). 외부 report 가 권위면 월 사용액을
// effectiveLimit.usedUsd 로 치환하고, 한도는 effectiveLimit.limitUsd(외부 quota 우선,
// 부재 시 로컬 한도와 동일 체인)를 쓴다. 설정 provider 서브탭·도넛 팝오버가 이 단일
// 투영만 호출한다(각자 재구현 금지).
export function computeProviderUsageLimits(
  entry: ProviderUsageEntry,
  now: number | Date = Date.now()
): UsageLimitsView {
  const eff = entry.effectiveLimit
  const summary: CostSummary =
    eff.source === 'external'
      ? { ...entry.summary, month: { ...entry.summary.month, totalCostUsd: eff.usedUsd } }
      : entry.summary
  return computeUsageLimits(summary, eff.limitUsd, now)
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
  const week = { period: 'week', resetAt: nextWeekReset(now).getTime() } as const
  const month = { period: 'month', resetAt: nextMonthReset(now).getTime() } as const

  // 무제한(한도 미설정) — 예산·퍼센트 없이 사용액만 노출.
  if (limitUsd == null || limitUsd <= 0) {
    return {
      week: { ...week, used: wUsed, budget: null, pct: 0, unlimited: true },
      month: { ...month, used: mUsed, budget: null, pct: 0, unlimited: true }
    }
  }

  const remainingLimit = Math.max(0, limitUsd - mUsed)
  const daysLeftInMonth = monthDaysLeft(now)
  const perDay = daysLeftInMonth > 0 ? remainingLimit / daysLeftInMonth : 0
  const weekRemainingBudget = perDay * weekDaysLeft(now)
  const weekBudget = wUsed + weekRemainingBudget

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
