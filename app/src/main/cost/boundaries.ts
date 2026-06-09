export interface CostBoundaries {
  dayStart: number
  weekStart: number
  monthStart: number
}

// 로컬 타임존 기준 day/week/month 시작 epoch ms. 주 시작은 한국 업무 캘린더에 맞춰 월요일.
export function boundaries(now: number | Date = Date.now()): CostBoundaries {
  const d = now instanceof Date ? new Date(now.getTime()) : new Date(now)
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const week = new Date(day)
  const mondayOffset = (day.getDay() + 6) % 7
  week.setDate(day.getDate() - mondayOffset)
  const month = new Date(d.getFullYear(), d.getMonth(), 1)
  return {
    dayStart: day.getTime(),
    weekStart: week.getTime(),
    monthStart: month.getTime()
  }
}
