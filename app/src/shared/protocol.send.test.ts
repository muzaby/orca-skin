import { describe, it, expect } from 'vitest'
import { SendChatMessageSchema, SetPermissionModeSchema } from './protocol'

const base = { sessionId: null, projectId: null, text: 'hi' }

describe('SendChatMessageSchema — permissionMode (정규화 6종)', () => {
  it('permissionMode 부재를 허용', () => {
    expect(SendChatMessageSchema.safeParse(base).success).toBe(true)
  })

  it('정규화 6종을 모두 허용', () => {
    for (const mode of [
      'default',
      'accept_edits',
      'plan',
      'dont_ask',
      'bypass',
      'auto_classified'
    ]) {
      expect(SendChatMessageSchema.safeParse({ ...base, permissionMode: mode }).success).toBe(true)
    }
  })

  it('SDK camelCase(acceptEdits/bypassPermissions)나 알 수 없는 모드를 거부', () => {
    for (const mode of ['acceptEdits', 'bypassPermissions', 'nope']) {
      expect(SendChatMessageSchema.safeParse({ ...base, permissionMode: mode }).success).toBe(false)
    }
  })
})

describe('SetPermissionModeSchema', () => {
  it('유효한 sessionId + 정규화 모드를 허용', () => {
    expect(SetPermissionModeSchema.safeParse({ sessionId: 's1', mode: 'bypass' }).success).toBe(
      true
    )
  })

  it('빈 sessionId 를 거부', () => {
    expect(SetPermissionModeSchema.safeParse({ sessionId: '', mode: 'plan' }).success).toBe(false)
  })

  it('알 수 없는 모드를 거부', () => {
    expect(
      SetPermissionModeSchema.safeParse({ sessionId: 's1', mode: 'acceptEdits' }).success
    ).toBe(false)
  })
})
