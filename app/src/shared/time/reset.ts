// 재설정 시각 계산 — 주간/월간 한도가 언제 리셋되는지(순수, 로컬타임).
// 주간: 다음 월요일 00:00 (오늘이 월요일이어도 다음 월요일) · 월간: 다음 달 1일 00:00.
// 사람이 읽는 문장은 renderer i18n 카탈로그가 만든다(formatResetLabel, 0100 — 구 resetLabels.ts).

import { toDate } from './clock'

export function nextWeekReset(now: number | Date = Date.now()): Date {
  const d = toDate(now)
  const daysUntilNextMonday = (8 - d.getDay()) % 7 || 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilNextMonday)
}

export function nextMonthReset(now: number | Date = Date.now()): Date {
  const d = toDate(now)
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}
