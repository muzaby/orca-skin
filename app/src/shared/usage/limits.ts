// 사용량 한도 파생 — 실사용량과 기간 예산을 받아 주간/월간 프로그레스바 뷰모델을 만든다.
// **유일한 계산 지점**: 이 순수 함수 밖에서 주/월 한도를 재계산하지 않는다(SSOT 요구).
// 통화는 추정 비용(totalCostUsd, 청구 권위 아님 — 폴백)이다.
//
// 0186 — 정본이 Main 으로 옮겨졌다. 이 파일을 부르는 곳은 main 의 `features/usage/usage-compose`
// 하나이고, renderer 는 완성된 `UsageLimitsView` 를 IPC 로 받아 표시만 한다(계산 금지).
// 파일 자체는 순수 TS(런타임 의존 0)라 main·renderer 어느 쪽에서도 import 할 수 있다.

import type { CostSummary } from '../ipc'
import { daysInMonth, weekDaysInMonth } from '../time/clock'
import { nextMonthReset, nextWeekReset } from '../time/reset'

// 이 막대의 `used` 가 무엇을 센 값인지.
//   'local'           = 이 PC 의 Orca 사용량만 (기본값이자 주간의 유일한 값)
//   'remote-baseline' = 계정 기준선 + 기준시각 이후 이 PC 증분
//
// 'remote' 가 아니라 'remote-baseline' 인 이유: 원격이 `used` 전체를 대체하는 것이 아니라
// **기준선만** 제공하고 그 위에 로컬 증분을 얹기 때문이다. 'remote' 라고 쓰면 "이 숫자는 전부
// 원격이 센 것" 으로 오독된다.
export type UsageSource = 'local' | 'remote-baseline'

export interface UsageLimitBar {
  used: number // USD, 해당 기간 사용량 (source 가 의미를 규정한다)
  budget: number | null // USD, 기간 예산 envelope (무제한이면 null)
  pct: number // 0..1, used/budget 클램프
  period: 'week' | 'month'
  resetAt: number // epoch ms, 다음 재설정 시각 — 문장화는 renderer i18n(formatResetLabel)
  unlimited: boolean
  source: UsageSource
}

// 적용 중인 예산이 어디서 왔는가. 'remote' 면 사용자가 설정에 넣은 값 대신 원격 한도가
// 적용되고 있다는 뜻이고, 설정 화면이 그 사실을 밝혀야 한다(입력해도 안 바뀌는 것처럼 보인다).
export type BudgetSource = 'configured' | 'remote'

export interface UsageLimitsView {
  week: UsageLimitBar
  month: UsageLimitBar
  // 주간 예산은 월 한도에서 일할 파생되므로 출처가 월과 같다 — 바마다 두지 않고 뷰에 한 번 둔다.
  budgetSource: BudgetSource
  // 사용자가 설정에 저장해 둔 월 한도. 원격이 이기고 있어도 편집기는 이 값을 보여줘야 한다
  // (원격이 사라지면 다시 이 값이 적용된다).
  configuredLimitUsd: number | null
}

// main→renderer delta (0186) — **변경된 scope 만** 보낸다. 전체 provider map 을 매번 push 하면
// provider 가 늘수록 턴마다 낭비가 커진다.
//
// 이 타입이 `shared/ipc.ts` 가 아니라 여기 있는 이유: `ipc.ts` 가 `UsageLimitsView` 를 import
// 하면 이 파일이 `CostSummary` 를 가져가는 것과 맞물려 순환이 된다(`import/no-cycle`).
export type UsageDelta =
  | { scope: 'global'; value: UsageLimitsView }
  | { scope: 'provider'; providerKey: string; value: UsageLimitsView }
  // 기간 경계(자정)를 넘었다 — 새 전역 값을 싣고, **캐시된 provider 뷰를 전부 무효화하라**는
  // 신호를 겸한다.
  //
  // 왜 provider 값을 함께 보내지 않나: 그러려면 자정마다 전 provider 를 DB 재집계해야 하고
  // 그건 "affected-provider 만" 성능 계약을 깬다. 무효화만 보내고 **화면이 실제로 필요로 하는
  // provider 만** 다시 조회하게 한다.
  | { scope: 'boundary'; value: UsageLimitsView }

// 기간별 실사용액(USD). 주간은 언제나 로컬이고, 월간만 기준선 합성 결과가 들어올 수 있다.
export interface UsageUsed {
  week: number
  month: number
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0
  return x > 1 ? 1 : x
}

// 로컬 집계(CostSummary)만으로 파생하는 기본 경로. 전역 사용량이 이 경로를 쓴다.
export function computeUsageLimits(
  summary: CostSummary,
  limitUsd: number | null,
  now: number | Date = Date.now()
): UsageLimitsView {
  return computeUsageLimitsFrom(
    { week: summary.week.totalCostUsd, month: summary.month.totalCostUsd },
    limitUsd,
    now
  )
}

// 주간 예산(고정 일할 — 0111, 구 런웨이 공식 대체):
//   perDay = 월 한도 / 이달 총 일수                        (한 달 내내 고정)
//   weekBudget = perDay * 이번 주 중 이달에 속한 일수       (경계 주는 이달 몫만)
//   weekPct = 이번 주 실사용 / weekBudget
// 사용량·경과일과 무관한 고정 envelope 라 weekPct 가 이번 주 실지출에만 반응한다.
// 월간: monthPct = 이달 실사용 / 월 한도.
//
// `used` 를 summary 가 아니라 값으로 받는 이유(0186): provider 월간은 원격 기준선 + 로컬 증분으로
// 합성될 수 있어 CostSummary 한 곳에서 나오지 않는다. 합성 판정은 호출자(usage-compose)가 하고
// 여기서는 예산·퍼센트 파생만 한다.
export function computeUsageLimitsFrom(
  used: UsageUsed,
  limitUsd: number | null,
  now: number | Date = Date.now(),
  source: { week: UsageSource; month: UsageSource } = { week: 'local', month: 'local' },
  // 예산 출처. 생략하면 적용값이 곧 사용자 설정값이다(원격 한도가 없는 기본 경로).
  budget: { budgetSource: BudgetSource; configuredLimitUsd: number | null } = {
    budgetSource: 'configured',
    configuredLimitUsd: limitUsd
  }
): UsageLimitsView {
  const week = {
    period: 'week',
    resetAt: nextWeekReset(now).getTime(),
    source: source.week
  } as const
  const month = {
    period: 'month',
    resetAt: nextMonthReset(now).getTime(),
    source: source.month
  } as const

  // 무제한(한도 미설정) — 예산·퍼센트 없이 사용액만 노출.
  if (limitUsd == null || limitUsd <= 0) {
    return {
      ...budget,
      week: { ...week, used: used.week, budget: null, pct: 0, unlimited: true },
      month: { ...month, used: used.month, budget: null, pct: 0, unlimited: true }
    }
  }

  const totalDaysInMonth = daysInMonth(now)
  const perDay = totalDaysInMonth > 0 ? limitUsd / totalDaysInMonth : 0
  const weekBudget = perDay * weekDaysInMonth(now)

  return {
    ...budget,
    week: {
      ...week,
      used: used.week,
      budget: weekBudget,
      pct: weekBudget > 0 ? clamp01(used.week / weekBudget) : 0,
      unlimited: false
    },
    month: {
      ...month,
      used: used.month,
      budget: limitUsd,
      pct: clamp01(used.month / limitUsd),
      unlimited: false
    }
  }
}
