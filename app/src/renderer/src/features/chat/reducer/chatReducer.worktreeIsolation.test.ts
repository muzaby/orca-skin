import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState } from './chatReducer'
import type { NormalizedEvent } from '../../../../../shared/ipc'

describe('S6 recovered worktree isolation', () => {
  it.each([
    [{ worktree: null }, false],
    [{ worktree: { sourceCwd: '/source', repoRoot: '/repo' } }, true],
    [{ cwd: '/source' }, true]
  ] as const)('clears isolation only for explicit worktree:null: %j', (patch, isolated) => {
    const state = {
      ...initialChatState,
      sessionId: 's1',
      worktreeIsolation: true,
      worktree: { sourceCwd: '/old', repoRoot: '/old' }
    }
    const next = chatReducer(state, {
      type: 'RECV_EVENT',
      event: { type: 'session.updated', sessionId: 's1', patch } as NormalizedEvent
    })
    expect(next.worktreeIsolation).toBe(isolated)
    expect(next.worktree).toEqual('worktree' in patch ? patch.worktree : state.worktree)
  })
})
