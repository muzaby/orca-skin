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

describe('SendChatMessageSchema — forkFrom/handoffFrom (0062)', () => {
  it('forkFrom 단독(새 세션 + text)을 허용한다', () => {
    expect(SendChatMessageSchema.safeParse({ ...base, forkFrom: 'src-1' }).success).toBe(true)
  })

  it('handoffFrom 은 text 생략(빈 문자열)을 허용한다 — main 이 자동 메시지로 대체', () => {
    expect(
      SendChatMessageSchema.safeParse({ ...base, text: '', handoffFrom: 'src-1' }).success
    ).toBe(true)
  })

  it('handoffFrom 없이 빈 text 는 거부한다(기존 min(1) 보존)', () => {
    expect(SendChatMessageSchema.safeParse({ ...base, text: '' }).success).toBe(false)
  })

  it('forkFrom/handoffFrom 동시 지정은 거부한다(상호 배타)', () => {
    expect(
      SendChatMessageSchema.safeParse({ ...base, forkFrom: 'a', handoffFrom: 'b' }).success
    ).toBe(false)
  })

  it('resume send(sessionId != null)와의 조합은 거부한다(새 세션 전용)', () => {
    expect(
      SendChatMessageSchema.safeParse({ ...base, sessionId: 's1', forkFrom: 'a' }).success
    ).toBe(false)
    expect(
      SendChatMessageSchema.safeParse({ ...base, sessionId: 's1', text: '', handoffFrom: 'a' })
        .success
    ).toBe(false)
  })

  it('빈 문자열 forkFrom/handoffFrom 은 거부한다', () => {
    expect(SendChatMessageSchema.safeParse({ ...base, forkFrom: '' }).success).toBe(false)
    expect(SendChatMessageSchema.safeParse({ ...base, handoffFrom: '' }).success).toBe(false)
  })
})
