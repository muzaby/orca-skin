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
})
