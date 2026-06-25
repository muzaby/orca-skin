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
  approvalId,
  origin: 'agent',
  action: { kind: 'tool_approval', toolName, input: { command: 'ls -la' } }
})

describe('chatReducer — 위험 도구 승인(tool_approval) 큐', () => {
  it('기본값은 빈 큐', () => {
    expect(initialChatState.pendingToolApprovals).toEqual([])
  })

  it('tool_approval 이벤트가 큐에 append', () => {
    const s = chatReducer(initialChatState, recv(toolEvent('t1')))
    expect(s.pendingToolApprovals).toEqual([
      { approvalId: 't1', toolName: 'Bash', input: { command: 'ls -la' } }
    ])
  })

  it('동시 요청은 덮어쓰지 않고 모두 보존한다 (서브에이전트 병렬)', () => {
    let s = chatReducer(initialChatState, recv(toolEvent('t1', 'Bash')))
    s = chatReducer(s, recv(toolEvent('t2', 'Write')))
    s = chatReducer(s, recv(toolEvent('t3', 'Edit')))
    expect(s.pendingToolApprovals.map((a) => a.approvalId)).toEqual(['t1', 't2', 't3'])
  })

  it('RESOLVE_TOOL_APPROVAL 은 해당 approvalId 만 제거하고 나머지는 유지', () => {
    let s = chatReducer(initialChatState, recv(toolEvent('t1')))
    s = chatReducer(s, recv(toolEvent('t2')))
    s = chatReducer(s, recv(toolEvent('t3')))
    s = chatReducer(s, { type: 'RESOLVE_TOOL_APPROVAL', approvalId: 't2' })
    expect(s.pendingToolApprovals.map((a) => a.approvalId)).toEqual(['t1', 't3'])
    s = chatReducer(s, { type: 'RESOLVE_TOOL_APPROVAL', approvalId: 't1' })
    s = chatReducer(s, { type: 'RESOLVE_TOOL_APPROVAL', approvalId: 't3' })
    expect(s.pendingToolApprovals).toEqual([])
  })

  it('CANCEL_CHAT / NEW_CHAT / error 가 큐를 비운다', () => {
    let withTools = chatReducer(initialChatState, recv(toolEvent('t1')))
    withTools = chatReducer(withTools, recv(toolEvent('t2')))
    expect(chatReducer(withTools, { type: 'CANCEL_CHAT' }).pendingToolApprovals).toEqual([])
    expect(chatReducer(withTools, { type: 'NEW_CHAT' }).pendingToolApprovals).toEqual([])
    expect(
      chatReducer(
        withTools,
        recv({
          type: 'error',
          error: { category: 'schema_validation_error', message: 'x', retryable: false }
        })
      ).pendingToolApprovals
    ).toEqual([])
  })

  it('plan_review 와 독립 — 서로의 게이트를 건드리지 않는다', () => {
    const withTool = chatReducer(initialChatState, recv(toolEvent('t1')))
    expect(withTool.pendingPlanReview).toBeNull()
    expect(withTool.pendingToolApprovals).toHaveLength(1)
  })
})
