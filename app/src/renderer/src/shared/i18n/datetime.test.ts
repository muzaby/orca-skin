// 날짜/시간 포맷터(0096) — timeZone/now 주입으로 결정론 검증. 핵심: 저장(epoch ms, UTC 절대시각)
// ↔ 표시(대상 타임존 보정) 분리, "같은 날" 판정이 타임존 기준으로 계산되는지(DST 포함).

import { describe, expect, it } from 'vitest'
import {
  formatDateLong,
  formatDateMedium,
  formatMonthDay,
  formatRelativeDay,
  formatTimeFull,
  formatTimeShort
} from './datetime'

// 2026-07-15T03:30:00Z — 서울(UTC+9) 12:30 수요일, 뉴욕(UTC-4, EDT) 7/14 23:30 화요일.
const T = Date.UTC(2026, 6, 15, 3, 30)

// ko 시각(hour12 dayPeriod '오전/오후' vs 'AM/PM')은 ICU/CLDR 버전에 따라 글리프가 달라
// 리터럴 고정이 브리틀하다 — 같은 옵션의 Intl 참조 출력과 비교해 "우리 함수가 로케일·타임존·
// 프리셋을 올바르게 전달했는가"(로직)만 검증한다. en-US 는 안정적이라 리터럴 유지.
function ref(
  locale: string,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions,
  ms: number
): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(ms)
}
const KO_TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true }

describe('formatTimeShort — 같은 날이면 시각, 다른 날이면 월·일', () => {
  it('서울: 같은 날 → 시각(ko/en)', () => {
    const opts = { timeZone: 'Asia/Seoul', now: T + 60_000 }
    expect(formatTimeShort(T, 'ko', opts)).toBe(ref('ko-KR', 'Asia/Seoul', KO_TIME, T))
    expect(formatTimeShort(T, 'en', opts)).toBe('12:30 PM')
  })

  it('타임존 경계 — 같은 UTC 순간이 서울에선 오늘, 뉴욕에선 어제 날짜', () => {
    const now = T + 60_000
    // 뉴욕 기준 T 는 7/14, now 도 7/14 23:31 → 같은 날 → 시각.
    expect(formatTimeShort(T, 'en', { timeZone: 'America/New_York', now })).toBe('11:30 PM')
    // now 를 뉴욕의 다음 날(7/15 01:00 EDT = 05:00Z)로 밀면 다른 날 → 월·일.
    const nextDayNy = Date.UTC(2026, 6, 15, 5)
    expect(formatTimeShort(T, 'en', { timeZone: 'America/New_York', now: nextDayNy })).toBe(
      'July 14'
    )
    // 같은 now 라도 서울 기준으론 둘 다 7/15 → 여전히 시각(월·일 형식이 아님).
    expect(formatTimeShort(T, 'ko', { timeZone: 'Asia/Seoul', now: nextDayNy })).toBe(
      ref('ko-KR', 'Asia/Seoul', KO_TIME, T)
    )
  })

  it('DST 전환일(뉴욕 2026-03-08) — 오프셋 보정 정확', () => {
    // 06:59Z = EST(UTC-5) 01:59, 08:00Z = EDT(UTC-4) 04:00 — 같은 날, 전환을 건너 정확 표시.
    const before = Date.UTC(2026, 2, 8, 6, 59)
    const after = Date.UTC(2026, 2, 8, 8, 0)
    const opts = { timeZone: 'America/New_York', now: after }
    expect(formatTimeShort(before, 'en', opts)).toBe('1:59 AM')
    expect(formatTimeShort(after, 'en', opts)).toBe('4:00 AM')
  })
})

describe('전체/날짜 포맷 — 로케일·타임존 명시', () => {
  it('formatTimeFull', () => {
    expect(formatTimeFull(T, 'ko', { timeZone: 'Asia/Seoul' })).toBe(
      ref(
        'ko-KR',
        'Asia/Seoul',
        {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        },
        T
      )
    )
    expect(formatTimeFull(T, 'en', { timeZone: 'America/New_York' })).toBe('7/14/2026, 11:30:00 PM')
  })

  it('formatMonthDay / formatDateLong / formatDateMedium', () => {
    expect(formatMonthDay(T, 'ko', { timeZone: 'Asia/Seoul' })).toBe('7월 15일')
    expect(formatMonthDay(T, 'en', { timeZone: 'America/New_York' })).toBe('July 14')
    expect(formatDateLong(T, 'ko', { timeZone: 'Asia/Seoul' })).toBe('2026년 7월 15일')
    expect(formatDateLong(T, 'en', { timeZone: 'Asia/Seoul' })).toBe('July 15, 2026')
    expect(formatDateMedium(T, 'ko', { timeZone: 'Asia/Seoul' })).toBe('2026. 7. 15.')
    expect(formatDateMedium(T, 'en', { timeZone: 'Asia/Seoul' })).toBe('Jul 15, 2026')
  })
})

describe('formatRelativeDay — 방금→어제→N일 전→월·일 사다리', () => {
  const now = T

  it('ko 사다리(구 ProjectsScreen.formatRelative 동일)', () => {
    const opts = { timeZone: 'Asia/Seoul', now }
    expect(formatRelativeDay(now - 30_000, 'ko', opts)).toBe('방금')
    expect(formatRelativeDay(now - 5 * 60_000, 'ko', opts)).toBe('5분 전')
    expect(formatRelativeDay(now - 26 * 3_600_000, 'ko', opts)).toBe('어제')
    expect(formatRelativeDay(now - 4 * 86_400_000, 'ko', opts)).toBe('4일 전')
    expect(formatRelativeDay(now - 10 * 86_400_000, 'ko', opts)).toBe('7월 5일')
  })

  it('en 사다리', () => {
    const opts = { timeZone: 'Asia/Seoul', now }
    expect(formatRelativeDay(now - 30_000, 'en', opts)).toBe('just now')
    expect(formatRelativeDay(now - 26 * 3_600_000, 'en', opts)).toBe('yesterday')
    expect(formatRelativeDay(now - 4 * 86_400_000, 'en', opts)).toBe('4 days ago')
    expect(formatRelativeDay(now - 10 * 86_400_000, 'en', opts)).toBe('July 5')
  })
})
