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

// AC9 — 유예된 기준 브랜치. 격리와 **함께만** 소비되므로 그 조합을 스키마가 강제한다.
describe('SendChatMessageSchema worktreeBaseRef (AC9)', () => {
  it('격리와 함께 온 브랜치는 통과한다', () => {
    expect(
      SendChatMessageSchema.safeParse({
        ...base,
        worktreeIsolation: true,
        worktreeBaseRef: 'feature/login'
      }).success
    ).toBe(true)
  })

  it('격리 없이 온 브랜치는 거부한다 — 조용히 무시하면 사용자는 고른 줄 안다', () => {
    expect(SendChatMessageSchema.safeParse({ ...base, worktreeBaseRef: 'feature' }).success).toBe(
      false
    )
    expect(
      SendChatMessageSchema.safeParse({
        ...base,
        worktreeIsolation: false,
        worktreeBaseRef: 'feature'
      }).success
    ).toBe(false)
  })

  it('브랜치 이름 규칙은 checkout 과 같은 SSOT 를 쓴다 — 옵션 주입을 거른다', () => {
    for (const branch of ['-f', '--upload-pack=x', 'a..b', 'x.lock', '']) {
      expect(
        SendChatMessageSchema.safeParse({
          ...base,
          worktreeIsolation: true,
          worktreeBaseRef: branch
        }).success,
        branch
      ).toBe(false)
    }
  })
})
