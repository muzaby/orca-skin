// 재설정 라벨 — 주간/월간 한도가 언제 리셋되는지 사람이 읽는 문구(순수, 로컬타임).
// 주간: 다음 월요일 00:00 · 월간: 다음 달 1일. 요일은 실제 날짜에서 파생한다.
// 예: 주간 "(월) 오전 0:00에 재설정" · 월간 "(토) 8월 1일에 재설정".
// locale 은 UI 표시 언어(0096) — 의존성 0 레이어라 인라인 ko/en 사전, 기본 'ko' 하위 호환.

import { toDate } from './clock'
import type { TimeLocale } from './relative'

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
] as const

// 다음 월요일 00:00 에 재설정. (오늘이 월요일이어도 이번 주기가 아닌 다음 월요일.)
export function weekResetLabel(now: number | Date = Date.now(), locale: TimeLocale = 'ko'): string {
  const d = toDate(now)
  const daysUntilNextMonday = (8 - d.getDay()) % 7 || 7
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilNextMonday)
  if (locale === 'ko') return `(${WEEKDAY_KO[next.getDay()]}) 오전 0:00에 재설정`
  return `Resets (${WEEKDAY_EN[next.getDay()]}) at 12:00 AM`
}

// 다음 달 1일에 재설정.
export function monthResetLabel(
  now: number | Date = Date.now(),
  locale: TimeLocale = 'ko'
): string {
  const d = toDate(now)
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  if (locale === 'ko') {
    return `(${WEEKDAY_KO[next.getDay()]}) ${next.getMonth() + 1}월 ${next.getDate()}일에 재설정`
  }
  return `Resets (${WEEKDAY_EN[next.getDay()]}) ${MONTH_EN[next.getMonth()]} ${next.getDate()}`
}
