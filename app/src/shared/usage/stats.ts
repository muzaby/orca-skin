// 사용량 요약(0112) 순수 헬퍼 — main(범위 경계 계산)·renderer(제로필/주간 집계) 공유.
// 일 경계는 clock.ts 와 동일하게 Date 생성자의 OS 로컬 타임존을 쓴다(타임존 파라미터 없음).
// SQL 쪽 일 버킷(date(...,'localtime'))과 같은 'YYYY-MM-DD' 키를 생성해야 한다.

import type { UsageStatsDay, UsageStatsRange } from '../ipc'

// 제로필 시계열이 렌더러에서 무한히 자라지 않도록 하는 보호선 — '전체' 범위에서
// 오늘 기준 최근 2년까지만 일 단위로 펼친다(그 이전 행은 잘림, 표시 전용 캡).
export const MAX_FILLED_DAYS = 730

// 일 단위 막대가 서브픽셀로 붕괴하기 전에 주 단위 버킷으로 접는 표시 전용 임계.
export const WEEKLY_AGGREGATION_THRESHOLD_DAYS = 90

export interface TokenBreakdown {
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}

// "토큰" 합산 정의의 단일 지점 — input+output+cache 4종 전체 합산(사용자 확정, 0112).
export function totalTokens(row: TokenBreakdown): number {
  return (
    row.inputTokens + row.outputTokens + row.cacheCreationInputTokens + row.cacheReadInputTokens
  )
}

// 범위 → since(epoch ms, 로컬 자정 기준). '7d'=오늘 포함 7일, '30d'=오늘 포함 30일, 'all'=0.
export function rangeSince(range: UsageStatsRange, now = Date.now()): number {
  if (range === 'all') return 0
  const back = range === '7d' ? 6 : 29
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime()
}

// epoch ms → 로컬 'YYYY-MM-DD'. SQL date(...,'localtime') 버킷 키와 포맷 동일.
export function localDayKey(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function zeroDay(day: string): UsageStatsDay {
  return {
    day,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalCostUsd: 0
  }
}

// 희소 시계열을 연속 일자로 제로필한다. since!=null(7d/30d)이면 since 일부터 오늘까지
// 고정 길이, since=null('전체')이면 가장 이른 행부터 오늘까지. 오늘 이후 키(시계 스큐)는
// 버리고, 전체 길이는 MAX_FILLED_DAYS 로 캡한다(최근 구간 우선).
export function fillDailySeries(
  days: UsageStatsDay[],
  since: number | null,
  now = Date.now()
): UsageStatsDay[] {
  const todayKey = localDayKey(now)
  const valid = days.filter((r) => r.day <= todayKey)
  let start: Date
  if (since != null) {
    start = parseDayKey(localDayKey(since))
  } else {
    if (valid.length === 0) return []
    start = parseDayKey(valid[0].day)
  }
  const today = parseDayKey(todayKey)
  const spanDays = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1
  if (spanDays > MAX_FILLED_DAYS) {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - MAX_FILLED_DAYS + 1)
  }
  const byDay = new Map(valid.map((r) => [r.day, r]))
  const filled: UsageStatsDay[] = []
  for (let d = start; d <= today; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = localDayKey(d.getTime())
    filled.push(byDay.get(key) ?? zeroDay(key))
  }
  return filled
}

// 일 → 주(월요일 시작, clock.ts weekStart 와 동일 기준) 표시 전용 집계.
// day 키는 각 주의 월요일 날짜가 된다. '전체' 범위가 임계를 넘을 때만 사용한다.
export function aggregateWeekly(days: UsageStatsDay[]): UsageStatsDay[] {
  const byWeek = new Map<string, UsageStatsDay>()
  for (const row of days) {
    const d = parseDayKey(row.day)
    const mondayIdx = (d.getDay() + 6) % 7
    const weekKey = localDayKey(
      new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIdx).getTime()
    )
    const acc = byWeek.get(weekKey) ?? zeroDay(weekKey)
    acc.inputTokens += row.inputTokens
    acc.outputTokens += row.outputTokens
    acc.cacheCreationInputTokens += row.cacheCreationInputTokens
    acc.cacheReadInputTokens += row.cacheReadInputTokens
    acc.totalCostUsd += row.totalCostUsd
    byWeek.set(weekKey, acc)
  }
  return [...byWeek.values()].sort((a, b) => (a.day < b.day ? -1 : 1))
}
