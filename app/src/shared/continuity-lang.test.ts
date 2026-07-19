import { describe, it, expect } from 'vitest'
import { continuityLangFor, continuityTitle, CONTINUITY_TITLE_MARKER } from './continuity-lang'

describe('continuityLangFor — settings.language(자유 문자열) → ko/en 판정 (0127)', () => {
  it('한국어 계열은 ko', () => {
    expect(continuityLangFor('한국어')).toBe('ko')
    expect(continuityLangFor('한글')).toBe('ko')
    expect(continuityLangFor('korean')).toBe('ko')
    expect(continuityLangFor('Korean (반말)')).toBe('ko')
    expect(continuityLangFor('ko')).toBe('ko')
    expect(continuityLangFor('KO')).toBe('ko')
    expect(continuityLangFor('kor')).toBe('ko')
    expect(continuityLangFor('ko-KR')).toBe('ko')
  })

  it('미정의/공백은 ko (SettingsSchema 기본 "한국어" 정합)', () => {
    expect(continuityLangFor(undefined)).toBe('ko')
    expect(continuityLangFor('')).toBe('ko')
    expect(continuityLangFor('   ')).toBe('ko')
  })

  it('그 외 언어는 전부 en', () => {
    expect(continuityLangFor('English')).toBe('en')
    expect(continuityLangFor('日本語')).toBe('en')
    expect(continuityLangFor('Español')).toBe('en')
    expect(continuityLangFor('français')).toBe('en')
  })

  it("'ko' 부분 문자열 오탐 없음", () => {
    expect(continuityLangFor('kokoro')).toBe('en')
    expect(continuityLangFor('Kosovan')).toBe('en')
  })
})

describe('continuityTitle — [마커] base 단일 조립점', () => {
  it('ko 마커는 기존 문자열과 바이트 동일 (draft↔물질화 계약 무회귀)', () => {
    expect(CONTINUITY_TITLE_MARKER.ko).toEqual({ fork: '분기', handoff: '핸드오프' })
    expect(continuityTitle('fork', 'ko', '원본 세션')).toBe('[분기] 원본 세션')
    expect(continuityTitle('handoff', 'ko', '원본 세션')).toBe('[핸드오프] 원본 세션')
  })

  it('en 마커', () => {
    expect(continuityTitle('fork', 'en', 'My chat')).toBe('[Fork] My chat')
    expect(continuityTitle('handoff', 'en', 'My chat')).toBe('[Handoff] My chat')
  })
})
