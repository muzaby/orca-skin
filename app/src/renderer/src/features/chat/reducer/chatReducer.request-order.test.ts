import { describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import { chatReducer, initialChatState, type ChatAction, type ChatState } from './chatReducer'

function request(
  id: string,
  kind: 'ask_question' | 'tool_approval',
  child = false
): NormalizedEvent {
  const providerRequest = {
    requestId: id,
    generation: 'g',
    toolUseId: `tool-${id}`,
    ...(child ? { agentId: 'child' } : {})
  }
  return {
    type: 'permission.requested',
    origin: 'agent',
    approvalId: id,
    action:
      kind === 'ask_question'
        ? { kind, request: { requestId: id, questions: [] }, providerRequest }
        : { kind, toolName: 'Read', input: { path: id }, providerRequest }
  }
}

function receive(state: ChatState, event: NormalizedEvent): ChatState {
  return chatReducer(state, { type: 'RECV_EVENT', event })
}

const mixed = (): ChatState =>
  [
    request('z', 'ask_question'),
    request('m', 'tool_approval'),
    request('a', 'ask_question')
  ].reduce(receive, initialChatState)

describe('mixed request arrival order', () => {
  it.each(['ask_question', 'tool_approval'] as const)(
    'records mixed requests in event arrival order, starting with %s',
    (first) => {
      const second = first === 'ask_question' ? 'tool_approval' : 'ask_question'
      const state = [request('z', first), request('m', second), request('a', first)].reduce(
        receive,
        initialChatState
      )
      expect(state.pendingRequestOrder).toEqual([
        { kind: first, requestId: 'z' },
        { kind: second, requestId: 'm' },
        { kind: first, requestId: 'a' }
      ])
      expect(state.pendingAsks.length + state.pendingToolApprovals.length).toBe(3)
    }
  )

  it.each([
    [{ type: 'RESOLVE_ASK', requestId: 'z' }, ['m', 'a']],
    [{ type: 'RESOLVE_TOOL_APPROVAL', approvalId: 'm' }, ['z', 'a']]
  ] satisfies [ChatAction, string[]][])(
    'removes only the locally resolved request from mixed order: %j',
    (action, ids) => {
      const state = chatReducer(mixed(), action)
      expect(state.pendingRequestOrder.map((entry) => entry.requestId)).toEqual(ids)
      expect(
        [
          ...state.pendingAsks.map((ask) => ask.requestId),
          ...state.pendingToolApprovals.map((approval) => approval.approvalId)
        ].sort()
      ).toEqual([...ids].sort())
      expect(chatReducer(state, action)).toEqual(state)
    }
  )

  it.each(['z', 'm', 'a'])('removes externally resolved request %s without reordering', (id) => {
    const state = receive(mixed(), {
      type: 'permission.resolved',
      approvalId: id,
      resolution: { behavior: 'deny' }
    })
    expect(state.pendingRequestOrder.map((entry) => entry.requestId)).toEqual(
      ['z', 'm', 'a'].filter((entry) => entry !== id)
    )
  })

  it.each([
    { type: 'NEW_CHAT' },
    { type: 'START_LOAD_SESSION', sessionId: 'other', title: null },
    {
      type: 'LOAD_SESSION',
      session: { id: 'other', backend: 'opencode', agentKind: 'code', title: null, messages: [] }
    }
  ] satisfies ChatAction[])(
    'clears request order on new chat and session loading: $type',
    (action) => {
      const state = chatReducer(mixed(), action)
      expect(state.pendingRequestOrder).toEqual([])
      expect(state.pendingAsks).toEqual([])
      expect(state.pendingToolApprovals).toEqual([])
    }
  )

  it.each([
    { type: 'CANCEL_CHAT' },
    {
      type: 'RECV_EVENT',
      event: { type: 'turn.aborted', sessionId: 's', reason: 'user_cancelled' }
    },
    {
      type: 'RECV_EVENT',
      event: {
        type: 'error',
        sessionId: 's',
        error: { category: 'stream_error', message: 'failed', retryable: false }
      }
    }
  ] satisfies ChatAction[])('preserves surviving child requests in arrival order: %j', (action) => {
    const before = [
      request('z', 'tool_approval', true),
      request('m', 'ask_question'),
      request('a', 'ask_question', true),
      request('b', 'tool_approval')
    ].reduce(receive, initialChatState)
    const state = chatReducer(before, action)
    expect(state.pendingRequestOrder).toEqual([
      { kind: 'tool_approval', requestId: 'z' },
      { kind: 'ask_question', requestId: 'a' }
    ])
    expect(state.pendingAsks.map((ask) => ask.requestId)).toEqual(['a'])
    expect(state.pendingToolApprovals.map((approval) => approval.approvalId)).toEqual(['z'])
  })
})
