// 사용량 한도 파생 — 실사용량 SSOT(main UsageTracker → renderer costStore 의 CostSummary)와
// 월 지출 한도(설정)를 받아 주간/월간 프로그레스바 뷰모델을 만든다. **유일한 계산 지점**:
// 설정 화면과 도넛 팝오버 둘 다 이 순수 함수만 호출하고 각자 재계산하지 않는다(SSOT 요구).
// 통화는 추정 비용(totalCostUsd, 청구 권위 아님 — 폴백)이다.

import type { CostSummary, ProviderUsageEntry } from '../ipc'
import { daysInMonth, toDate, weekDaysElapsedInMonth, weekDaysInMonth } from '../time/clock'
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

// provider 엔트리 → 한도 뷰모델(0098/0100/0111). 외부 report 가 권위면 월 사용액을
// effectiveLimit.usedUsd 로 치환하고, 한도는 effectiveLimit.limitUsd(외부 quota 우선,
// 부재 시 로컬 한도와 동일 체인)를 쓴다. 설정 provider 서브탭·도넛 팝오버가 이 단일
// 투영만 호출한다(각자 재구현 금지).
//
// 외부 월간 총액은 Orca 분 + 외부(비-Orca) 분을 모두 포함한 권위값이고, 로컬 summary 는
// 그중 일부에 대한 SDK 추정치다. 그래서 주/일 used 를 다음처럼 정합한다(0111):
//   external·fresh  → 월=권위 M, 주/일=로컬 추정치를 M/로컬월 배로 스케일(분포는 로컬 신뢰).
//   external·stale  → fetch 실패로 baseline 만 있음. 월=max(baseline, 로컬월), 주/일=로컬 원값.
//   local           → 변경 없음.
// 모두 표시 시점 순수 파생이라 refresh 성공(stale=false) 시 자동으로 권위값으로 복구된다.
export function computeProviderUsageLimits(
  entry: ProviderUsageEntry,
  now: number | Date = Date.now()
): UsageLimitsView {
  const eff = entry.effectiveLimit
  let summary = entry.summary
  if (eff.source === 'external') {
    summary = eff.stale
      ? staleExternalSummary(entry.summary, eff.usedUsd)
      : reconcileExternalSummary(entry.summary, eff.usedUsd, now)
  }
  return computeUsageLimits(summary, eff.limitUsd, now)
}

// external·fresh: 권위 월간(monthUsed)에 로컬 주/일 추정치를 크기 정합. 분포는 로컬을
// 신뢰하고 총량만 monthUsed 에 맞춘다(lw≤lm·ld≤lw 이므로 정합 후에도 week≤month·day≤week).
// 로컬 월사용≈0(스케일 불능)이면 외부 사용을 이달 경과일에 균등 분배해 주/일에 배분한다.
function reconcileExternalSummary(
  local: CostSummary,
  monthUsed: number,
  now: number | Date
): CostSummary {
  const lm = local.month.totalCostUsd
  let weekUsed: number
  let dayUsed: number
  if (lm > 0) {
    const scale = monthUsed / lm
    weekUsed = local.week.totalCostUsd * scale
    dayUsed = local.day.totalCostUsd * scale
  } else {
    const elapsedDays = toDate(now).getDate()
    const perDay = elapsedDays > 0 ? monthUsed / elapsedDays : 0
    weekUsed = perDay * weekDaysElapsedInMonth(now)
    dayUsed = perDay
  }
  return {
    ...local,
    month: { ...local.month, totalCostUsd: monthUsed },
    week: { ...local.week, totalCostUsd: weekUsed },
    day: { ...local.day, totalCostUsd: dayUsed }
  }
}

// external·stale: 마지막 성공 baseline(monthUsed)을 월간 바닥값으로, 로컬이 그 위로
// 자라면 로컬을 채택한다. 주/일은 로컬 추정 원값(스케일 없음) — 오프라인 중 최근 활동 반영.
function staleExternalSummary(local: CostSummary, monthUsed: number): CostSummary {
  return {
    ...local,
    month: { ...local.month, totalCostUsd: Math.max(monthUsed, local.month.totalCostUsd) }
  }
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
