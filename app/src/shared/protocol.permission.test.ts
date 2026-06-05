import { describe, it, expect } from 'vitest'
import { PermissionRespondSchema } from './protocol'

describe('PermissionRespondSchema — allow 분기', () => {
  it('빈 allow 를 허용', () => {
    const r = PermissionRespondSchema.safeParse({
      approvalId: 'a1',
      resolution: { behavior: 'allow' }
    })
    expect(r.success).toBe(true)
  })

  it('updatedInput(임의 형태) + updatedPermissions(session) 를 허용', () => {
    const r = PermissionRespondSchema.safeParse({
      approvalId: 'a1',
      resolution: {
        behavior: 'allow',
        updatedInput: { answers: { Q: 'A' }, response: 'go' },
        updatedPermissions: [{ toolName: 'Bash', scope: 'session' }]
      }
    })
    expect(r.success).toBe(true)
  })

  it('updatedPermissions 의 scope 가 session 이 아니면 거부', () => {
    const r = PermissionRespondSchema.safeParse({
      approvalId: 'a1',
      resolution: {
        behavior: 'allow',
        updatedPermissions: [{ toolName: 'Bash', scope: 'always' }]
      }
    })
    expect(r.success).toBe(false)
  })
})

describe('PermissionRespondSchema — deny 분기', () => {
  it('빈 deny 를 허용', () => {
    expect(
      PermissionRespondSchema.safeParse({ approvalId: 'a1', resolution: { behavior: 'deny' } })
        .success
    ).toBe(true)
  })

  it('message + interrupt 를 허용', () => {
    const r = PermissionRespondSchema.safeParse({
      approvalId: 'a1',
      resolution: { behavior: 'deny', message: '수정해줘', interrupt: true }
    })
    expect(r.success).toBe(true)
  })
})

describe('PermissionRespondSchema — 무효 입력', () => {
  it('approvalId 누락을 거부', () => {
    expect(PermissionRespondSchema.safeParse({ resolution: { behavior: 'allow' } }).success).toBe(
      false
    )
  })

  it('빈 approvalId 를 거부', () => {
    expect(
      PermissionRespondSchema.safeParse({ approvalId: '', resolution: { behavior: 'allow' } })
        .success
    ).toBe(false)
  })

  it('알 수 없는 behavior 를 거부', () => {
    expect(
      PermissionRespondSchema.safeParse({ approvalId: 'a1', resolution: { behavior: 'maybe' } })
        .success
    ).toBe(false)
  })
})
