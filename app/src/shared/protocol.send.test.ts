import { describe, it, expect } from 'vitest'
import { SendChatMessageSchema } from './protocol'

const base = { sessionId: null, projectId: null, text: 'hi' }

describe('SendChatMessageSchema — permissionMode', () => {
  it('permissionMode 부재를 허용', () => {
    const r = SendChatMessageSchema.safeParse(base)
    expect(r.success).toBe(true)
  })

  it("'plan' / 'acceptEdits' 를 허용", () => {
    expect(SendChatMessageSchema.safeParse({ ...base, permissionMode: 'plan' }).success).toBe(true)
    expect(
      SendChatMessageSchema.safeParse({ ...base, permissionMode: 'acceptEdits' }).success
    ).toBe(true)
  })

  it('알 수 없는 모드를 거부', () => {
    expect(
      SendChatMessageSchema.safeParse({ ...base, permissionMode: 'bypassPermissions' }).success
    ).toBe(false)
  })
})
