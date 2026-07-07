// 재설정 라벨 — 주간/월간 한도가 언제 리셋되는지 사람이 읽는 한국어 문구(순수, 로컬타임).
// 주간: 다음 월요일 00:00 · 월간: 다음 달 1일. 요일은 실제 날짜에서 파생한다.
// 예: 주간 "(월) 오전 0:00에 재설정" · 월간 "(토) 8월 1일에 재설정".

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

function toDate(now: number | Date): Date {
  return typeof now === 'number' ? new Date(now) : new Date(now.getTime())
}

// 다음 월요일 00:00 에 재설정. (오늘이 월요일이어도 이번 주기가 아닌 다음 월요일.)
export function weekResetLabel(now: number | Date = Date.now()): string {
  const d = toDate(now)
  const daysUntilNextMonday = (8 - d.getDay()) % 7 || 7
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilNextMonday)
  return `(${WEEKDAY_KO[next.getDay()]}) 오전 0:00에 재설정`
}

// 다음 달 1일에 재설정.
export function monthResetLabel(now: number | Date = Date.now()): string {
  const d = toDate(now)
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return `(${WEEKDAY_KO[next.getDay()]}) ${next.getMonth() + 1}월 ${next.getDate()}일에 재설정`
}
