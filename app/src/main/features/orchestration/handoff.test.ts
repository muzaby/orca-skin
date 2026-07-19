import { describe, expect, it } from 'vitest'
import { buildHandoffMessage } from './handoff'

describe('buildHandoffMessage', () => {
  it('출발 세션 제목을 {title} 자리에 보간한다', () => {
    const msg = buildHandoffMessage('결제 모듈 리팩토링', 'abcdef12-3456')
    expect(msg).toContain('이전 세션 "결제 모듈 리팩토링"에서')
    expect(msg).not.toContain('{title}')
  })

  it('제목이 없으면(null/공백) 세션 id 앞 8자로 폴백한다', () => {
    expect(buildHandoffMessage(null, 'abcdef12-3456')).toContain('이전 세션 "abcdef12"에서')
    expect(buildHandoffMessage('   ', 'abcdef12-3456')).toContain('이전 세션 "abcdef12"에서')
  })

  it('/compact 접두와 [핸드오프] 마커는 불변이다', () => {
    const msg = buildHandoffMessage('제목', 'abcdef12-3456')
    expect(msg.startsWith('/compact [핸드오프] ')).toBe(true)
  })

  it('요약 구조 지시(5항목)와 verbatim 보존 규칙을 담는다', () => {
    const msg = buildHandoffMessage(null, 'abcdef12-3456')
    for (const marker of ['①', '②', '③', '④', '⑤']) expect(msg).toContain(marker)
    expect(msg).toContain('원문 그대로 보존')
  })

  it("lang 미전달은 'ko' 기본 — 기존 한글 템플릿과 동일 (하위호환)", () => {
    expect(buildHandoffMessage('제목', 'abcdef12-3456')).toBe(
      buildHandoffMessage('제목', 'abcdef12-3456', 'ko')
    )
  })
})

describe('buildHandoffMessage — en (0127, 발생 시점 선호 언어 스냅샷)', () => {
  it('/compact 접두와 [Handoff] 마커, {title} 보간·id 8자 폴백', () => {
    const msg = buildHandoffMessage('Payment refactor', 'abcdef12-3456', 'en', 'English')
    expect(msg.startsWith('/compact [Handoff] ')).toBe(true)
    expect(msg).toContain('previous session "Payment refactor"')
    expect(msg).not.toContain('{title}')
    expect(buildHandoffMessage(null, 'abcdef12-3456', 'en')).toContain(
      'previous session "abcdef12"'
    )
  })

  it('ko 템플릿과 동일 구조(①~⑤·verbatim 보존)를 유지한다', () => {
    const msg = buildHandoffMessage(null, 'abcdef12-3456', 'en')
    for (const marker of ['①', '②', '③', '④', '⑤']) expect(msg).toContain(marker)
    expect(msg).toContain('verbatim')
  })

  it('요약 산출 언어를 선호 언어 원문으로 지시하고, 미전달/공백이면 English 폴백', () => {
    expect(buildHandoffMessage(null, 'abcdef12-3456', 'en', '日本語')).toContain(
      'Write the summary in 日本語.'
    )
    expect(buildHandoffMessage(null, 'abcdef12-3456', 'en')).toContain(
      'Write the summary in English.'
    )
    expect(buildHandoffMessage(null, 'abcdef12-3456', 'en', '  ')).toContain(
      'Write the summary in English.'
    )
    expect(buildHandoffMessage(null, 'abcdef12-3456', 'en', 'Español')).not.toContain('{language}')
  })
})
