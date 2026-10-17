import { describe, expect, it } from 'vitest'
import { initialChatState } from '../../../reducer/chatReducer'
import { selectOpenCodeRequest } from './requestQueue'

describe('OpenCode request head', () => {
  it('selects the earliest live request without sorting identifiers', () => {
    const question = { requestId: 'z', questions: [] }
    const permission = { approvalId: 'a', toolName: 'Read', input: {} }
    const state = {
      ...initialChatState,
      pendingAsks: [question],
      pendingToolApprovals: [permission],
      pendingRequestOrder: [
        { kind: 'tool_approval' as const, requestId: 'stale' },
        { kind: 'ask_question' as const, requestId: 'z' },
        { kind: 'tool_approval' as const, requestId: 'a' }
      ]
    }
    expect(selectOpenCodeRequest(state)).toEqual({ kind: 'ask_question', request: question })
    expect(selectOpenCodeRequest({ ...state, pendingAsks: [] })).toEqual({
      kind: 'tool_approval',
      request: permission
    })
    expect(
      selectOpenCodeRequest({ ...state, pendingAsks: [], pendingToolApprovals: [] })
    ).toBeUndefined()
    expect(selectOpenCodeRequest(initialChatState)).toBeUndefined()
  })
})
