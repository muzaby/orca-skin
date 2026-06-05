import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState } from './chatReducer'
import type { NormalizedEvent } from '../../../../../shared/ipc'

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

// 위험 도구 게이트는 permission.requested(action.kind='tool_approval')로 도착한다.
const toolEvent = (approvalId: string, toolName = 'Bash'): NormalizedEvent => ({
  type: 'permission.requested',
  provider: 'claude-code',
  approvalId,
  origin: 'agent',
  action: { kind: 'tool_approval', toolName, input: { command: 'ls -la' } }
})

describe('chatReducer — 위험 도구 승인(tool_approval)', () => {
  it('기본값은 null', () => {
    expect(initialChatState.pendingToolApproval).toBeNull()
  })

  it('tool_approval 이벤트가 pendingToolApproval 을 세팅', () => {
    const s = chatReducer(initialChatState, recv(toolEvent('t1')))
    expect(s.pendingToolApproval).toEqual({
      approvalId: 't1',
      toolName: 'Bash',
      input: { command: 'ls -la' }
    })
  })

  it('RESOLVE_TOOL_APPROVAL 이 게이트를 비운다', () => {
    const withTool = chatReducer(initialChatState, recv(toolEvent('t1')))
    const cleared = chatReducer(withTool, { type: 'RESOLVE_TOOL_APPROVAL' })
    expect(cleared.pendingToolApproval).toBeNull()
  })

  it('CANCEL_CHAT / NEW_CHAT / error 가 게이트를 비운다', () => {
    const withTool = chatReducer(initialChatState, recv(toolEvent('t1')))
    expect(chatReducer(withTool, { type: 'CANCEL_CHAT' }).pendingToolApproval).toBeNull()
    expect(chatReducer(withTool, { type: 'NEW_CHAT' }).pendingToolApproval).toBeNull()
    expect(
      chatReducer(
        withTool,
        recv({
          type: 'error',
          provider: 'claude-code',
          error: { category: 'schema_validation_error', message: 'x', retryable: false }
        })
      ).pendingToolApproval
    ).toBeNull()
  })

  it('plan_review 와 독립 — 서로의 게이트를 건드리지 않는다', () => {
    const withTool = chatReducer(initialChatState, recv(toolEvent('t1')))
    expect(withTool.pendingPlanReview).toBeNull()
    expect(withTool.pendingToolApproval).not.toBeNull()
  })
})
