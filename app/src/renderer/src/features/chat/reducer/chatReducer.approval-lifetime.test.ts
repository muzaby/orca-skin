import { describe, expect, it } from 'vitest'
import type { NormalizedEvent, ProviderApprovalRequest } from '../../../../../shared/ipc'
import { chatReducer, initialChatState, type ChatAction, type ChatState } from './chatReducer'

const recv = (event: NormalizedEvent): ChatAction => ({ type: 'RECV_EVENT', event })
const providerRequest = (id: string, child: boolean): ProviderApprovalRequest => ({
  requestId: `request-${id}`,
  toolUseId: `tool-${id}`,
  ...(child ? { agentId: `agent-${id}` } : {}),
  generation: 'generation-1'
})

const ask = (id: string, child: boolean): NormalizedEvent => ({
  type: 'permission.requested',
  approvalId: id,
  origin: 'agent',
  action: {
    kind: 'ask_question',
    request: { requestId: id, questions: [] },
    providerRequest: providerRequest(id, child)
  }
})

const plan = (id: string, child: boolean): NormalizedEvent => ({
  type: 'permission.requested',
  approvalId: id,
  origin: 'agent',
  action: {
    kind: 'plan_review',
    request: { requestId: id, plan: '# Plan' },
    providerRequest: providerRequest(id, child)
  }
})

const tool = (id: string, child: boolean): NormalizedEvent => ({
  type: 'permission.requested',
  approvalId: id,
  origin: 'agent',
  action: {
    kind: 'tool_approval',
    toolName: 'Bash',
    input: { command: 'echo raw' },
    providerRequest: providerRequest(id, child)
  }
})

function pendingApprovals(): ChatState {
  let state = chatReducer(initialChatState, recv(ask('main-ask', false)))
  state = chatReducer(state, recv(ask('child-ask', true)))
  state = chatReducer(state, recv(tool('main-tool', false)))
  state = chatReducer(state, recv(tool('child-tool', true)))
  return chatReducer(state, recv(plan('child-plan', true)))
}

describe('chatReducer child approval lifetime', () => {
  it('keeps provider identity on every approval surface', () => {
    const state = pendingApprovals()
    expect(state.pendingAsks[1].providerRequest).toEqual(providerRequest('child-ask', true))
    expect(state.pendingToolApprovals[1].providerRequest).toEqual(
      providerRequest('child-tool', true)
    )
    expect(state.pendingPlanReview?.providerRequest).toEqual(providerRequest('child-plan', true))
  })

  it.each([
    ['turn.aborted', recv({ type: 'turn.aborted', sessionId: 's1', reason: 'user_cancelled' })],
    [
      'error',
      recv({
        type: 'error',
        sessionId: 's1',
        error: { category: 'stream_error', message: 'failed', retryable: false }
      })
    ],
    ['CANCEL_CHAT', { type: 'CANCEL_CHAT' } as ChatAction]
  ])('preserves child approvals and clears main approvals on %s', (_name, action) => {
    const next = chatReducer(pendingApprovals(), action)
    expect(next.pendingAsks.map((request) => request.requestId)).toEqual(['child-ask'])
    expect(next.pendingToolApprovals.map((request) => request.approvalId)).toEqual(['child-tool'])
    expect(next.pendingPlanReview?.requestId).toBe('child-plan')
  })
})
