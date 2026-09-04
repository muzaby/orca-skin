import { describe, expect, it } from 'vitest'
import type { GitDiffPatch } from '../../../../../shared/ipc'
import { chatReducer, initialChatState } from './chatReducer'

const request = { key: 'repo-session', generation: 1 }
const a = { kind: 'commit', sha: 'a' } as const
const b = { kind: 'commit', sha: 'b' } as const
const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'head', oid: 'base' },
  files: [],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

describe('completed commit cache', () => {
  it('runtime cwd changes clear cached scopes and reject the old request', () => {
    let state = chatReducer(
      { ...initialChatState, cwd: '/repo' },
      { type: 'BEGIN_GIT_SNAPSHOT_QUERY', request }
    )
    state = chatReducer(state, { type: 'SET_DIFF_COMPARISON', comparison: a })
    state = chatReducer(state, { type: 'RECEIVE_GIT_PATCH', request, comparison: a, patch })
    state = chatReducer(state, {
      type: 'RECV_EVENT',
      event: { type: 'session.updated', sessionId: 's', patch: { cwd: '/new-repo' } }
    })
    expect(state.gitSnapshot.patch).toBeNull()
    expect(state.gitSnapshotRequest).toBeNull()
    state = chatReducer(state, { type: 'RECEIVE_GIT_PATCH', request, comparison: a, patch })
    expect(state.gitSnapshot.patch).toBeNull()
  })
  it('A → B → A restores the completed patch without a loading frame', () => {
    let state = chatReducer(initialChatState, { type: 'BEGIN_GIT_SNAPSHOT_QUERY', request })
    state = chatReducer(state, { type: 'SET_DIFF_COMPARISON', comparison: a })
    state = chatReducer(state, { type: 'RECEIVE_GIT_PATCH', request, comparison: a, patch })
    state = chatReducer(state, { type: 'SET_DIFF_COMPARISON', comparison: b })
    expect(state.gitSnapshot.patch).toBeNull()
    state = chatReducer(state, { type: 'SET_DIFF_COMPARISON', comparison: a })
    expect(state.gitSnapshot.patch).toBe(patch)
    const nextRequest = { ...request, generation: 2 }
    state = chatReducer(state, { type: 'BEGIN_GIT_SNAPSHOT_QUERY', request: nextRequest })
    expect(state.gitSnapshot.patch).toBeNull()
    state = chatReducer(state, { type: 'RECEIVE_GIT_PATCH', request, comparison: a, patch })
    state = chatReducer(state, { type: 'SET_DIFF_COMPARISON', comparison: b })
    state = chatReducer(state, { type: 'SET_DIFF_COMPARISON', comparison: a })
    expect(state.gitSnapshot.patch).toBeNull()
  })
})
