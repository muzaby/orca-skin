// 사용량 뷰 합성 (0186) — **순수 모듈.** DB·electron 의존 0 이라 단위 테스트 대상이다.
//
// 여기가 "화면에 뜨는 숫자가 무엇을 센 값인가" 를 정하는 유일한 지점이다. 의미 계약:
//
//   로컬 원장   : 항상 이 PC 의 Orca 사용량만 기록. 읽기 시점 합성이지 원장 수정이 아니다.
//   전역 사용량 : week = local · month = local · budget = spendingLimitUsd
//   provider    : week   = 항상 local
//                 month  = 기준선 사용 가능 ? 계정 기준선 + asOf 이후 이 PC 증분 : local
//                 budget = 원격 한도 ?? 사용자 설정 한도            (원격이 정본)
//
// 원격은 `used` 전체를 대체하지 않는다 — **기준선만** 준다. 그래서 `source` 어휘가
// 'remote' 가 아니라 'remote-baseline' 이다(`shared/usage/limits.ts`).

import type { CostSummary } from '../../../shared/ipc'
import { boundaries } from '../../../shared/time/clock'
import {
  computeUsageLimits,
  computeUsageLimitsFrom,
  type UsageLimitsView
} from '../../../shared/usage/limits'
import type { UsageSnapshot } from './fetcher'

// provider 한정 로컬 집계. `monthDeltaCostUsd` 는 `asOf` 이후의 월간 증분이다.
//
// **왜 별도 필드인가**: 기존 provider 집계 쿼리의 WHERE 하한(`monthStart`)을 `asOf` 로 올려
// 재사용하고 싶어지지만, 그러면 같은 스캔에서 나오는 `week` 가 asOf 이전 사용분을 잃는다
// (주간은 언제나 로컬 전량이어야 한다). 하한은 그대로 두고 월간 증분만 조건부 SUM 으로 더 뽑는다.
export interface ProviderLocalUsage {
  summary: CostSummary
  monthDeltaCostUsd: number
}

// 기준선을 쓸 수 있는가 — 네 조건을 **전부** 만족해야 한다.
//
// `baselineUsable !== true` 로 검사하는 것에 주의: 미지정(`undefined`)도 거부한다(fail-closed).
// `=== false` 로 쓰면 미지정이 통과해, watermark 를 보장하지 않는 배포에서 조용히 이중 계상된다.
export function baselineApplies(
  snapshot: UsageSnapshot | null | undefined,
  now: number | Date = Date.now()
): snapshot is UsageSnapshot & { asOf: number; usedUsd: number } {
  if (!snapshot) return false
  if (snapshot.baselineUsable !== true) return false
  if (snapshot.asOf == null || snapshot.usedUsd == null) return false
  // 지난달 기준선 위에 이번 달 증분을 얹으면 지난달 사용액이 이번 달에 섞인다.
  return snapshot.asOf >= boundaries(now).monthStart
}

// 전역 사용량 — **원격을 보지 않는다.** 계정 단위 원격 리포트는 provider 축에만 존재하고,
// 전역은 이 PC 의 전체 합이라 대응하는 원격 값이 없다.
export function composeGlobalUsage(
  summary: CostSummary,
  spendingLimitUsd: number | null,
  now: number | Date = Date.now()
): UsageLimitsView {
  return computeUsageLimits(summary, spendingLimitUsd, now)
}

// provider 사용량 — 기준선 합성이 일어나는 유일한 곳.
export function composeProviderUsage(
  local: ProviderLocalUsage,
  snapshot: UsageSnapshot | null | undefined,
  configuredLimitUsd: number | null,
  now: number | Date = Date.now()
): UsageLimitsView {
  // 한도는 기준선 사용 여부와 **독립적으로** 원격이 정본이다(사용자 결정). 기준선을 못 써도
  // 원격이 한도를 줬다면 그 한도를 쓴다 — 못 쓰는 것은 `used` 뿐이다.
  const remoteLimit = snapshot?.limitUsd ?? null
  const budget = remoteLimit ?? configuredLimitUsd
  // 사용자 입력값은 계속 저장돼 있고 원격이 사라지면 다시 적용된다 — 설정 편집기가 그 값을
  // 보여줘야 하므로 적용값과 함께 실어 보낸다.
  const provenance = {
    budgetSource: (remoteLimit != null ? 'remote' : 'configured') as 'remote' | 'configured',
    configuredLimitUsd
  }

  if (!baselineApplies(snapshot, now)) {
    return computeUsageLimitsFrom(
      { week: local.summary.week.totalCostUsd, month: local.summary.month.totalCostUsd },
      budget,
      now,
      { week: 'local', month: 'local' },
      provenance
    )
  }

  return computeUsageLimitsFrom(
    {
      week: local.summary.week.totalCostUsd,
      month: snapshot.usedUsd + local.monthDeltaCostUsd
    },
    budget,
    now,
    // 주간은 원격 기준선이 없다 — 원격이 월간만 보고한다(주간을 주는 배포가 생기면
    // snapshot.raw 에서 꺼내 컬럼을 늘린다).
    { week: 'local', month: 'remote-baseline' },
    provenance
  )
}
