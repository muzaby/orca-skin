import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState } from './chatReducer'

describe('chatReducer worktree isolation', () => {
  it('새 draft 기본값은 off이고 사용자가 켠 뒤 NEW_CHAT에서 다시 off다', () => {
    expect(initialChatState.worktreeIsolation).toBe(false)
    const enabled = chatReducer(initialChatState, { type: 'SET_WORKTREE_ISOLATION', enabled: true })
    expect(enabled.worktreeIsolation).toBe(true)
    expect(chatReducer(enabled, { type: 'NEW_CHAT' }).worktreeIsolation).toBe(false)
  })
})
