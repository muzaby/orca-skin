import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState } from './chatReducer'
import type { ChatEvent, PlanReviewRequest } from '../../../../../shared/ipc'

const REVIEW: PlanReviewRequest = { requestId: 'p1', plan: '# 계획\n- b.py 생성' }

const recv = (ev: ChatEvent): { type: 'RECV_EVENT'; event: ChatEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

describe('chatReducer — 계획 검토(plan_review)', () => {
  it('기본값은 null', () => {
    expect(initialChatState.pendingPlanReview).toBeNull()
  })

  it('plan_review 이벤트가 pendingPlanReview 에 설정된다', () => {
    const s = chatReducer(initialChatState, recv({ type: 'plan_review', data: REVIEW }))
    expect(s.pendingPlanReview).toEqual(REVIEW)
  })

  it('RESOLVE_PLAN 이 카드를 제거', () => {
    const withPlan = chatReducer(initialChatState, recv({ type: 'plan_review', data: REVIEW }))
    const cleared = chatReducer(withPlan, { type: 'RESOLVE_PLAN' })
    expect(cleared.pendingPlanReview).toBeNull()
  })

  it('CANCEL_CHAT / error / NEW_CHAT 가 카드를 비운다', () => {
    const withPlan = chatReducer(initialChatState, recv({ type: 'plan_review', data: REVIEW }))
    expect(chatReducer(withPlan, { type: 'CANCEL_CHAT' }).pendingPlanReview).toBeNull()
    expect(chatReducer(withPlan, { type: 'NEW_CHAT' }).pendingPlanReview).toBeNull()
    expect(
      chatReducer(
        withPlan,
        recv({ type: 'error', data: { code: 'internal', message: 'x', recoverable: false } })
      ).pendingPlanReview
    ).toBeNull()
  })
})
