import { describe, it, expect } from 'vitest'
import { OpenPathRequestSchema, SendChatMessageSchema, SetPermissionModeSchema } from './protocol'

const base = { sessionId: null, projectId: null, text: 'hi' }

describe('SendChatMessageSchema — permissionMode (정규화 6종)', () => {
  it('permissionMode/model 선택 필드 부재를 허용', () => {
    expect(SendChatMessageSchema.safeParse(base).success).toBe(true)
  })

  it('providerKey/modelFamily optional 필드를 허용한다', () => {
    expect(
      SendChatMessageSchema.safeParse({
        ...base,
        providerKey: 'claude-bedrock',
        modelFamily: 'sonnet'
      }).success
    ).toBe(true)
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

describe('SendChatMessageSchema — cwd', () => {
  it('새 세션 cwd payload 를 허용하고 빈 문자열은 거부한다', () => {
    expect(SendChatMessageSchema.safeParse({ ...base, cwd: '/repo/orca' }).success).toBe(true)
    expect(SendChatMessageSchema.safeParse({ ...base, cwd: null }).success).toBe(true)
    expect(SendChatMessageSchema.safeParse({ ...base, cwd: '' }).success).toBe(false)
  })
})

describe('OpenPathRequestSchema', () => {
  it('열 경로를 검증한다', () => {
    expect(OpenPathRequestSchema.safeParse({ path: '/repo/orca' }).success).toBe(true)
    expect(OpenPathRequestSchema.safeParse({ path: '' }).success).toBe(false)
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

describe('SendChatMessageSchema — effort', () => {
  it('effort 5종을 모두 허용한다', () => {
    for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) {
      expect(SendChatMessageSchema.safeParse({ ...base, effort }).success).toBe(true)
    }
  })

  it('알 수 없는 effort 를 거부한다', () => {
    expect(SendChatMessageSchema.safeParse({ ...base, effort: 'extreme' }).success).toBe(false)
  })
})

describe('SendChatMessageSchema — attachments', () => {
  const base = { sessionId: null, projectId: null, text: 'hello' }

  it('defaults attachments to [] for legacy payloads', () => {
    const parsed = SendChatMessageSchema.parse(base)
    expect(parsed.attachments).toEqual([])
  })

  it('accepts path and inline composer attachment variants', () => {
    expect(
      SendChatMessageSchema.safeParse({
        ...base,
        attachments: [
          {
            kind: 'path',
            path: '/home/user/a.md',
            name: 'a.md',
            mimeType: 'text/markdown',
            sourceKind: 'dialog'
          },
          {
            kind: 'inline',
            data: 'abc',
            name: 'paste.png',
            mimeType: 'image/png',
            sourceKind: 'clipboard'
          }
        ]
      }).success
    ).toBe(true)
  })
})
