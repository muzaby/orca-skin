// 로케일·타임존 명시 날짜/시간 포맷터(0096). 저장은 epoch ms(UTC 기준 절대시각),
// 표시는 로컬 PC(OS) 타임존으로 보정한다 — 모든 Intl.DateTimeFormat 에 timeZone 을
// **명시**해(기본값 = OS 감지값) 테스트가 타임존을 주입할 수 있고, "같은 날" 판정도
// getFullYear 류 암묵 로컬 대신 대상 타임존 기준으로 계산한다(DST 안전).
// 로케일은 UI 언어(ko/en) → BCP-47 매핑. 컴포넌트는 useI18n().locale 로 전달해
// 언어 전환 시 리렌더에 편승한다.

import i18next from 'i18next'
import { relativeTime } from '../../../../shared/time/relative'

export type UiLocale = 'ko' | 'en'

const BCP47: Record<UiLocale, string> = { ko: 'ko-KR', en: 'en-US' }

// 표시 형식 프리셋 — 기존 하드코딩 'ko-KR' 사이트들의 옵션을 그대로 승계.
const PRESETS = {
  time: { hour: 'numeric', minute: '2-digit', hour12: true },
  monthDay: { month: 'long', day: 'numeric' },
  monthDayShort: { month: 'short', day: 'numeric' },
  weekdayShort: { weekday: 'short' },
  full: {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  },
  dateLong: { year: 'numeric', month: 'long', day: 'numeric' },
  dateMedium: { dateStyle: 'medium' }
} satisfies Record<string, Intl.DateTimeFormatOptions>

type PresetId = keyof typeof PRESETS

export interface DateTimeOpts {
  // 테스트 주입용 — 생략 시 OS 타임존/현재 시각.
  timeZone?: string
  now?: number
}

export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Intl.DateTimeFormat 생성은 비싸다 — locale|tz|preset 키로 메모이즈.
const fmtCache = new Map<string, Intl.DateTimeFormat>()

function getFormat(locale: UiLocale, timeZone: string, preset: PresetId): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}|${preset}`
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(BCP47[locale], { ...PRESETS[preset], timeZone })
    fmtCache.set(key, f)
  }
  return f
}

// 대상 타임존 기준 y-m-d 키 — "같은 날" 판정용(로케일 무관, en-CA = ISO 형태).
const ymdCache = new Map<string, Intl.DateTimeFormat>()

function ymdInZone(ms: number, timeZone: string): string {
  let f = ymdCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone
    })
    ymdCache.set(timeZone, f)
  }
  return f.format(ms)
}

// 표시용 짧은 형식: 오늘이면 '오전 11:44'/'11:44 AM', 다른 날이면 '5월 13일'/'May 13'.
export function formatTimeShort(ms: number, locale: UiLocale, opts: DateTimeOpts = {}): string {
  const tz = opts.timeZone ?? systemTimeZone()
  const now = opts.now ?? Date.now()
  const sameDay = ymdInZone(ms, tz) === ymdInZone(now, tz)
  return getFormat(locale, tz, sameDay ? 'time' : 'monthDay').format(ms)
}

// 툴팁용 전체 형식: '2026. 5. 12. 오전 11:03:09' / '5/12/2026, 11:03:09 AM'.
export function formatTimeFull(ms: number, locale: UiLocale, opts: DateTimeOpts = {}): string {
  return getFormat(locale, opts.timeZone ?? systemTimeZone(), 'full').format(ms)
}

// '5월 13일' / 'May 13'.
export function formatMonthDay(ms: number, locale: UiLocale, opts: DateTimeOpts = {}): string {
  return getFormat(locale, opts.timeZone ?? systemTimeZone(), 'monthDay').format(ms)
}

// '2026년 7월 11일' / 'July 11, 2026'.
export function formatDateLong(ms: number, locale: UiLocale, opts: DateTimeOpts = {}): string {
  return getFormat(locale, opts.timeZone ?? systemTimeZone(), 'dateLong').format(ms)
}

// '2026. 7. 11.' / 'Jul 11, 2026' (dateStyle: medium).
export function formatDateMedium(ms: number, locale: UiLocale, opts: DateTimeOpts = {}): string {
  return getFormat(locale, opts.timeZone ?? systemTimeZone(), 'dateMedium').format(ms)
}

// 상대 시각 문장 — shared relativeTime(데이터)을 카탈로그 복수형 키로 문장화(0100).
// lng 를 명시해 훅 밖에서도 고정 로케일로 해석한다(언어 전환 리렌더는 호출 컴포넌트가
// useI18n().locale 로 편승 — 기존 패턴 동일).
export function formatRelativeTime(ms: number, locale: UiLocale, opts: DateTimeOpts = {}): string {
  const rel = relativeTime(ms, opts.now ?? Date.now())
  switch (rel.unit) {
    case 'now':
      return i18next.t('time.justNow', { lng: locale })
    case 'minute':
      return i18next.t('time.minutesAgo', { count: rel.value, lng: locale })
    case 'hour':
      return i18next.t('time.hoursAgo', { count: rel.value, lng: locale })
    case 'day':
      return i18next.t('time.daysAgo', { count: rel.value, lng: locale })
  }
}

// 재설정 문장 — shared 가 계산한 resetAt(다음 월요일 00:00 / 다음 달 1일)을 카탈로그 키 +
// Intl 요일/월·일 이름으로 문장화(0100). 주간은 요일만, 월간은 요일+월·일을 보간한다.
export function formatResetLabel(
  period: 'week' | 'month',
  resetAt: number,
  locale: UiLocale,
  opts: DateTimeOpts = {}
): string {
  const tz = opts.timeZone ?? systemTimeZone()
  const weekday = getFormat(locale, tz, 'weekdayShort').format(resetAt)
  if (period === 'week') return i18next.t('time.resetsWeek', { weekday, lng: locale })
  const date = getFormat(locale, tz, 'monthDayShort').format(resetAt)
  return i18next.t('time.resetsMonth', { weekday, date, lng: locale })
}

// "방금"→"어제"→"N일 전"→날짜 사다리 (구 ProjectsScreen.formatRelative 승계).
// 하루 미만은 formatRelativeTime, 어제/일 단위는 카탈로그 키, 7일 이상은 월·일 표기.
export function formatRelativeDay(ms: number, locale: UiLocale, opts: DateTimeOpts = {}): string {
  const now = opts.now ?? Date.now()
  const day = Math.floor((now - ms) / 86_400_000)
  if (day < 1) return formatRelativeTime(ms, locale, opts)
  if (day === 1) return i18next.t('time.yesterday', { lng: locale })
  if (day < 7) return i18next.t('time.daysAgo', { count: day, lng: locale })
  return formatMonthDay(ms, locale, opts)
}
