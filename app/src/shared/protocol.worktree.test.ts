import { describe, expect, it } from 'vitest'
import { SendChatMessageSchema } from './protocol'

const base = { sessionId: null, projectId: null, text: 'hello', clientKey: 'draft' }

describe('SendChatMessageSchema worktree isolation', () => {
  it('신규 일반 세션만 허용한다', () => {
    expect(SendChatMessageSchema.safeParse({ ...base, worktreeIsolation: true }).success).toBe(true)
    expect(
      SendChatMessageSchema.safeParse({ ...base, sessionId: 's1', worktreeIsolation: true }).success
    ).toBe(false)
    expect(
      SendChatMessageSchema.safeParse({ ...base, forkFrom: 's1', worktreeIsolation: true }).success
    ).toBe(false)
    expect(
      SendChatMessageSchema.safeParse({ ...base, handoffFrom: 's1', worktreeIsolation: true })
        .success
    ).toBe(false)
  })
})
