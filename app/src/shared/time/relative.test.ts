import { describe, it, expect } from 'vitest'
import { relativeTimeLabel } from './relative'

describe('relativeTimeLabel', () => {
  const now = 1_000_000_000_000

  it('1분 미만은 방금', () => {
    expect(relativeTimeLabel(now, now)).toBe('방금')
    expect(relativeTimeLabel(now - 59_000, now)).toBe('방금')
  })

  it('미래(then>now)도 방금으로 클램프', () => {
    expect(relativeTimeLabel(now + 5_000, now)).toBe('방금')
  })

  it('분 단위', () => {
    expect(relativeTimeLabel(now - 60_000, now)).toBe('1분 전')
    expect(relativeTimeLabel(now - 59 * 60_000, now)).toBe('59분 전')
  })

  it('시간 단위', () => {
    expect(relativeTimeLabel(now - 60 * 60_000, now)).toBe('1시간 전')
    expect(relativeTimeLabel(now - 23 * 60 * 60_000, now)).toBe('23시간 전')
  })

  it('일 단위', () => {
    expect(relativeTimeLabel(now - 24 * 60 * 60_000, now)).toBe('1일 전')
    expect(relativeTimeLabel(now - 3 * 24 * 60 * 60_000, now)).toBe('3일 전')
  })

  it("locale='en' — 영어 라벨 + 단복수", () => {
    expect(relativeTimeLabel(now, now, 'en')).toBe('just now')
    expect(relativeTimeLabel(now - 60_000, now, 'en')).toBe('1 minute ago')
    expect(relativeTimeLabel(now - 5 * 60_000, now, 'en')).toBe('5 minutes ago')
    expect(relativeTimeLabel(now - 60 * 60_000, now, 'en')).toBe('1 hour ago')
    expect(relativeTimeLabel(now - 23 * 60 * 60_000, now, 'en')).toBe('23 hours ago')
    expect(relativeTimeLabel(now - 24 * 60 * 60_000, now, 'en')).toBe('1 day ago')
    expect(relativeTimeLabel(now - 3 * 24 * 60 * 60_000, now, 'en')).toBe('3 days ago')
  })
})
