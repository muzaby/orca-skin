// 공용 시간/경계 유틸 — main·renderer 공유(순수, 런타임 의존 0). 로컬타임(OS 타임존) 기준.
// 구 main `features/usage/boundaries.ts` 로직을 여기로 이전해 단일 출처로 둔다(재설정 라벨·한도
// 파생이 같은 경계 정의를 공유하도록). 타임존 파라미터는 없다 — Date 생성자의 OS 로컬 타임존을 쓴다.

export interface PeriodBoundaries {
  dayStart: number
  weekStart: number
  monthStart: number
}

function toDate(now: number | Date): Date {
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
