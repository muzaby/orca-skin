import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import type { AskQuestionRequest, NormalizedEvent } from '../../../../../shared/ipc'

const REQ = (requestId: string): AskQuestionRequest => ({
  requestId,
  questions: [
    {
      question: 'Q?',
      header: 'H',
      options: [
        { label: 'A', description: '' },
        { label: 'B', description: '' }
      ],
      multiSelect: false
    }
  ]
})

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

// AskUserQuestion 은 permission.requested(action.kind='ask_question')로 도착한다(B2).
const askEvent = (id: string): NormalizedEvent => ({
  type: 'permission.requested',
  provider: 'claude-code',
  approvalId: id,
  origin: 'agent',
  action: { kind: 'ask_question', request: REQ(id) }
})

describe('chatReducer — AskUserQuestion 큐', () => {
  it('ask_question 이벤트가 pendingAsks 에 push 된다', () => {
    const s = chatReducer(initialChatState, recv(askEvent('r1')))
    expect(s.pendingAsks).toHaveLength(1)
    expect(s.pendingAsks[0].requestId).toBe('r1')
  })

  it('연속 ask_question 은 큐에 누적', () => {
    let s = chatReducer(initialChatState, recv(askEvent('r1')))
    s = chatReducer(s, recv(askEvent('r2')))
    expect(s.pendingAsks.map((a) => a.requestId)).toEqual(['r1', 'r2'])
  })

  it('RESOLVE_ASK 가 해당 requestId 만 제거', () => {
    let s = chatReducer(initialChatState, recv(askEvent('r1')))
    s = chatReducer(s, recv(askEvent('r2')))
    s = chatReducer(s, { type: 'RESOLVE_ASK', requestId: 'r1' })
    expect(s.pendingAsks.map((a) => a.requestId)).toEqual(['r2'])
  })

  it('NEW_CHAT / CANCEL_CHAT / error 가 큐를 비운다', () => {
    const withAsk: ChatState = chatReducer(initialChatState, recv(askEvent('r1')))
    expect(chatReducer(withAsk, { type: 'NEW_CHAT' }).pendingAsks).toEqual([])
    expect(chatReducer(withAsk, { type: 'CANCEL_CHAT' }).pendingAsks).toEqual([])
    expect(
      chatReducer(
        withAsk,
        recv({
          type: 'error',
          provider: 'claude-code',
          error: { category: 'schema_validation_error', message: 'x', retryable: false }
        })
      ).pendingAsks
    ).toEqual([])
  })
})
