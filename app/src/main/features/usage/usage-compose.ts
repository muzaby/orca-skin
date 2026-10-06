// 원격 칸이 있으면 커밋된 원격 값만 쓰며 미제공 수치는 0이다. 전역 원장은 별도로 유지한다.
import type { CostSummary } from '../../../shared/ipc'
import { boundaries } from '../../../shared/time/clock'
import {
  computeUsageLimitsFrom,
  type UsageLimitsView,
  type UsageSource
} from '../../../shared/usage/limits'
import { localDayKey, localMonthKey } from '../../../shared/usage/stats'
import type { UsageSnapshot } from './fetcher'

export interface ProviderLocalUsage {
  summary: CostSummary
  dayCostUsd?: ReadonlyMap<string, number>
}

export interface ProviderRemoteUsage {
  month: { costUsd: number | null } | null
  days: ReadonlyMap<string, number | null>
}

export function remoteMonthUsed(
  snapshot: UsageSnapshot | null | undefined,
  now: number | Date = Date.now()
): number | null {
  return snapshot?.usedUsd != null &&
    localMonthKey(snapshot.asOf ?? snapshot.fetchedAt) === localMonthKey(+now)
    ? snapshot.usedUsd
    : null
}

export function composeProviderUsage(
  local: ProviderLocalUsage,
  snapshot: UsageSnapshot | null | undefined,
  configuredLimitUsd: number | null,
  now: number | Date = Date.now(),
  remote?: ProviderRemoteUsage
): UsageLimitsView {
  const b = boundaries(now)
  const today = localDayKey(+now)
  const monthFrom = localDayKey(b.monthStart)
  const weekFrom = localDayKey(Math.max(b.weekStart, b.monthStart))
  const hasRemoteDay = (from: string): boolean =>
    [...(remote?.days.keys() ?? [])].some((day) => day >= from && day <= today)
  // 주·월 공용 합계: 원격 날짜 칸의 NULL은 0이며 같은 날 SDK 값을 읽지 않는다.
  const sumDays = (from: string): number => {
    const days = new Set([...(remote?.days.keys() ?? []), ...(local.dayCostUsd?.keys() ?? [])])
    let sum = 0
    for (const day of days) {
      if (day < from || day > today) continue
      sum += remote?.days.has(day) ? (remote.days.get(day) ?? 0) : (local.dayCostUsd?.get(day) ?? 0)
    }
    return sum
  }
  const monthUsedUsd = remoteMonthUsed(snapshot, now)
  let monthUsed = local.summary.month.totalCostUsd
  let monthSource: UsageSource = 'local'
  if (remote?.month || monthUsedUsd != null) {
    monthUsed = remote?.month?.costUsd ?? monthUsedUsd ?? 0
    monthSource = 'remote'
  } else if (hasRemoteDay(monthFrom)) {
    monthUsed = sumDays(monthFrom)
    monthSource = 'remote-daily'
  }
  const weekRemote = hasRemoteDay(weekFrom)
  const remoteLimit = snapshot?.limitUsd ?? null
  return computeUsageLimitsFrom(
    { week: weekRemote ? sumDays(weekFrom) : local.summary.week.totalCostUsd, month: monthUsed },
    remoteLimit ?? configuredLimitUsd,
    now,
    { week: weekRemote ? 'remote-daily' : 'local', month: monthSource },
    { budgetSource: remoteLimit != null ? 'remote' : 'configured', configuredLimitUsd }
  )
}
