import { describe, it, expect } from 'vitest'
import { agentPermissionRequest, classifyAppCommand } from './permission-bridge'
import type { AskQuestionRequest, PlanReviewRequest } from '../../shared/ipc'

describe('agentPermissionRequest', () => {
  it('ask_question 액션을 permission.requested(origin:agent)로 합성', () => {
    const request: AskQuestionRequest = { requestId: 'a1', questions: [] }
    const ev = agentPermissionRequest('claude-code', 'a1', { kind: 'ask_question', request })
    expect(ev).toEqual({
      type: 'permission.requested',
      provider: 'claude-code',
      approvalId: 'a1',
      origin: 'agent',
      action: { kind: 'ask_question', request }
    })
  })

  it('plan_review 액션을 합성하며 approvalId 를 보존', () => {
    const request: PlanReviewRequest = { requestId: 'p1', plan: '# 계획' }
    const ev = agentPermissionRequest('claude-code', 'p1', { kind: 'plan_review', request })
    expect(ev.approvalId).toBe('p1')
    expect(ev.origin).toBe('agent')
    expect(ev.action).toEqual({ kind: 'plan_review', request })
  })
})

describe('classifyAppCommand (AppCommandPolicy)', () => {
  it('미등록 명령은 보수적으로 require_approval', () => {
    expect(classifyAppCommand('unknown')).toBe('require_approval')
  })
})
