// 공용 시간/경계 유틸 — main·renderer 공유(순수, 런타임 의존 0). 로컬타임(OS 타임존) 기준.
// 구 main `features/usage/boundaries.ts` 로직을 여기로 이전해 단일 출처로 둔다(재설정 라벨·한도
// 파생이 같은 경계 정의를 공유하도록). 타임존 파라미터는 없다 — Date 생성자의 OS 로컬 타임존을 쓴다.

export interface PeriodBoundaries {
  dayStart: number
  weekStart: number
  monthStart: number
}

export function toDate(now: number | Date): Date {
  return typeof now === 'number' ? new Date(now) : new Date(now.getTime())
}

// 월=0 … 일=6 (getDay 은 일=0 … 토=6 이라 +6 %7 로 월요일 시작 인덱스로 회전).
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

// 로컬타임 기준 일/주/월 시작 경계. weekStart 는 월요일 00:00:00.000 이다.
export function boundaries(now: number | Date = Date.now()): PeriodBoundaries {
  const d = toDate(now)
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIndex(d)).getTime()
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  return { dayStart, weekStart, monthStart }
}

// 이번 달의 총 일수(다음 달 0일 = 이번 달 말일).
export function daysInMonth(now: number | Date = Date.now()): number {
  const d = toDate(now)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

// 오늘 포함, 이달의 남은 일수. (월말일 당일이면 1.)
export function monthDaysLeft(now: number | Date = Date.now()): number {
  const d = toDate(now)
  return daysInMonth(d) - d.getDate() + 1
}

// 오늘 포함, 이번 주(월~일)의 남은 일수. 월요일=7, 일요일=1.
export function weekDaysLeft(now: number | Date = Date.now()): number {
  return 7 - mondayIndex(toDate(now))
}

// 이번 주(월~일, 월요일 시작) 7일 중 keep 을 만족하는 일수. 아래 두 export 의 공용 루프.
function countWeekDays(now: number | Date, keep: (day: Date, d: Date) => boolean): number {
  const d = toDate(now)
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIndex(d))
  let count = 0
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    if (keep(day, d)) count++
  }
  return count
}

const sameMonth = (day: Date, d: Date): boolean =>
  day.getFullYear() === d.getFullYear() && day.getMonth() === d.getMonth()

// 이번 주(월~일) 중 '오늘이 속한 달' 에 속하는 일수. 경계 주(두 달에 걸친 주)는 이달 몫만 센다.
// 비경계 주=7. 오늘은 항상 이번 주·이번 달에 있으므로 최소 1.
export function weekDaysInMonth(now: number | Date = Date.now()): number {
  return countWeekDays(now, sameMonth)
}

// 이번 주(월~일) 중 '오늘이 속한 달' 에 속하면서 오늘까지 경과한 일수(오늘 포함).
// 외부 리포트 폴백(로컬 월사용≈0)에서 주간 몫을 배분할 때 쓴다.
export function weekDaysElapsedInMonth(now: number | Date = Date.now()): number {
  return countWeekDays(now, (day, d) => sameMonth(day, d) && day.getDate() <= d.getDate())
}
