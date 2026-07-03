export interface CostBoundaries {
  dayStart: number
  weekStart: number
  monthStart: number
}

// 로컬타임 기준 일/주/월 시작 경계. weekStart 는 월요일 00:00:00.000 이다.
export function boundaries(now: number | Date = Date.now()): CostBoundaries {
  const d = typeof now === 'number' ? new Date(now) : new Date(now.getTime())
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const day = d.getDay()
  const daysSinceMonday = (day + 6) % 7
  const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday).getTime()
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  return { dayStart, weekStart, monthStart }
}
