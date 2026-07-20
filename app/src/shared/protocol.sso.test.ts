import { describe, it, expect } from 'vitest'
import { SsoLoginRequestSchema } from './protocol'

describe('SsoLoginRequestSchema — SSO 로그인 요청', () => {
  it('input 레코드를 허용', () => {
    const r = SsoLoginRequestSchema.safeParse({ input: { employeeId: 'e123', password: 'pw' } })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.input.employeeId).toBe('e123')
  })

  it('input 누락 시 빈 레코드로 기본화', () => {
    const r = SsoLoginRequestSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.input).toEqual({})
  })

  it('비-문자열 값을 거부', () => {
    expect(SsoLoginRequestSchema.safeParse({ input: { a: 1 } }).success).toBe(false)
    expect(SsoLoginRequestSchema.safeParse({ input: { a: null } }).success).toBe(false)
  })

  it('상한 초과 값을 거부', () => {
    expect(SsoLoginRequestSchema.safeParse({ input: { a: 'x'.repeat(4097) } }).success).toBe(false)
  })
})
