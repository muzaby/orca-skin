import { describe, it, expect } from 'vitest'
import { agentPermissionRequest, classifyAppCommand } from './permission-bridge'
import type { AskQuestionRequest, PlanReviewRequest } from '../../../shared/ipc'

describe('agentPermissionRequest', () => {
  it('ask_question 액션을 permission.requested(origin:agent)로 합성', () => {
    const request: AskQuestionRequest = { requestId: 'a1', questions: [] }
    const ev = agentPermissionRequest('a1', { kind: 'ask_question', request })
    expect(ev).toEqual({
      type: 'permission.requested',
      approvalId: 'a1',
      origin: 'agent',
      action: { kind: 'ask_question', request }
    })
  })

  it('plan_review 액션을 합성하며 approvalId 를 보존', () => {
    const request: PlanReviewRequest = { requestId: 'p1', plan: '# 계획' }
    const ev = agentPermissionRequest('p1', { kind: 'plan_review', request })
    expect(ev.approvalId).toBe('p1')
    expect(ev.origin).toBe('agent')
    expect(ev.action).toEqual({ kind: 'plan_review', request })
  })

  // sessionId 계약 — renderer 가 활성 폴백 없이 소유 세션으로 라우팅하는 키.
  it('sessionId 를 넘기면 이벤트에 싣는다', () => {
    const request: AskQuestionRequest = { requestId: 'a1', questions: [] }
    const ev = agentPermissionRequest('a1', { kind: 'ask_question', request }, 's-42')
    expect(ev).toEqual({
      type: 'permission.requested',
      sessionId: 's-42',
      approvalId: 'a1',
      origin: 'agent',
      action: { kind: 'ask_question', request }
    })
  })

  it('sessionId 미전달 시 키를 생략한다(빈 문자열 금지 — 폴백 라우팅 유지)', () => {
    const request: AskQuestionRequest = { requestId: 'a1', questions: [] }
    expect('sessionId' in agentPermissionRequest('a1', { kind: 'ask_question', request })).toBe(
      false
    )
    expect('sessionId' in agentPermissionRequest('a1', { kind: 'ask_question', request }, '')).toBe(
      false
    )
  })
})

describe('classifyAppCommand (AppCommandPolicy)', () => {
  it('미등록 명령은 보수적으로 require_approval', () => {
    expect(classifyAppCommand('unknown')).toBe('require_approval')
  })
})
