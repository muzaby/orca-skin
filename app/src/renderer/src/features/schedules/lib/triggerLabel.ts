// 트리거 요약 문구 — 저장된 `TriggerSpec` 에서만 파생한다. 실제 발화 시각(`nextRunAt`)은
// main 이 주므로 여기서 cron 을 다시 계산하지 않는다.

import type { TFunction } from 'i18next'
import type { TimeOfDay, TriggerSpec, Weekday } from '../../../../../shared/scheduled-tasks'
import type { MessageKey } from '../../../shared/i18n'

export const WEEKDAY_LABEL_KEYS: Record<Weekday, MessageKey> = {
  0: 'schedules.trigger.day0',
  1: 'schedules.trigger.day1',
  2: 'schedules.trigger.day2',
  3: 'schedules.trigger.day3',
  4: 'schedules.trigger.day4',
  5: 'schedules.trigger.day5',
  6: 'schedules.trigger.day6'
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>()

// 날짜와 시각을 함께 — '1월 6일 09:00' / 'Jan 6, 09:00'. 공용 `formatTimeShort` 는 오늘이 아니면
// 날짜만 주므로 다음 실행·실행 이력에는 쓸 수 없다.
export function formatDateTime(ms: number, locale: 'ko' | 'en'): string {
  let format = dateTimeFormats.get(locale)
  if (!format) {
    format = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
    dateTimeFormats.set(locale, format)
  }
  return format.format(ms)
}

export function formatTimeOfDay(at: TimeOfDay): string {
  return `${String(at.hour).padStart(2, '0')}:${String(at.minute).padStart(2, '0')}`
}

// `GMT+9` · `GMT-3:30`. 인자는 UTC 기준 동쪽 분(= -Date#getTimezoneOffset()).
export function utcOffsetLabel(offsetMinutes: number = -new Date().getTimezoneOffset()): string {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  const minutes = abs % 60
  return `GMT${sign}${Math.floor(abs / 60)}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`
}

export function triggerSummary(trigger: TriggerSpec, tr: TFunction): string {
  switch (trigger.kind) {
    case 'hourly':
      return tr('schedules.trigger.hourly')
    case 'daily':
      return tr('schedules.trigger.daily', { time: formatTimeOfDay(trigger.at) })
    case 'weekly':
      return tr('schedules.trigger.weekly', {
        days: tr(WEEKDAY_LABEL_KEYS[trigger.day]),
        time: formatTimeOfDay(trigger.at)
      })
    case 'custom':
      return tr('schedules.trigger.weekly', {
        days: trigger.days.map((day) => tr(WEEKDAY_LABEL_KEYS[day])).join('·'),
        time: formatTimeOfDay(trigger.at)
      })
  }
}
