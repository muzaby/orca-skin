import { describe, it, expect } from 'vitest'
import { agentPermissionRequest, classifyAppCommand, isRiskyTool } from './permission-bridge'
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

describe('isRiskyTool (위험 도구 게이트 화이트리스트)', () => {
  it('상태 변경 도구는 위험으로 분류', () => {
    for (const t of ['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
      expect(isRiskyTool(t)).toBe(true)
    }
  })

  it('읽기 전용/조회 도구는 비위험(자동 통과)', () => {
    for (const t of ['Read', 'Glob', 'Grep', 'WebFetch', 'TodoWrite']) {
      expect(isRiskyTool(t)).toBe(false)
    }
  })

  it('알 수 없는 도구 이름은 비위험(화이트리스트 외)', () => {
    expect(isRiskyTool('SomeRandomTool')).toBe(false)
    expect(isRiskyTool('')).toBe(false)
  })
})
