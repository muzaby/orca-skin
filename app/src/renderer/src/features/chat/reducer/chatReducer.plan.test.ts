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

  it('계획 타일 기본값', () => {
    expect(initialChatState.planTileOpen).toBe(false)
    expect(initialChatState.planContent).toBeNull()
    expect(initialChatState.planTileWidth).toBe(360)
  })

  it('plan_review 이벤트가 pendingPlanReview + planContent 설정 + 타일 자동 오픈', () => {
    const s = chatReducer(initialChatState, recv({ type: 'plan_review', data: REVIEW }))
    expect(s.pendingPlanReview).toEqual(REVIEW)
    expect(s.planContent).toBe(REVIEW.plan)
    expect(s.planTileOpen).toBe(true)
  })

  it('RESOLVE_PLAN 은 게이트만 닫고 타일 내용/가시성은 유지(읽기전용)', () => {
    const withPlan = chatReducer(initialChatState, recv({ type: 'plan_review', data: REVIEW }))
    const cleared = chatReducer(withPlan, { type: 'RESOLVE_PLAN' })
    expect(cleared.pendingPlanReview).toBeNull()
    expect(cleared.planContent).toBe(REVIEW.plan)
    expect(cleared.planTileOpen).toBe(true)
  })

  it('TOGGLE_PLAN_TILE / SET_PLAN_TILE_OPEN 이 가시성을 제어', () => {
    const toggled = chatReducer(initialChatState, { type: 'TOGGLE_PLAN_TILE' })
    expect(toggled.planTileOpen).toBe(true)
    const closed = chatReducer(toggled, { type: 'SET_PLAN_TILE_OPEN', open: false })
    expect(closed.planTileOpen).toBe(false)
  })

  it('SET_PLAN_TILE_WIDTH 가 280–640 으로 clamp', () => {
    expect(
      chatReducer(initialChatState, { type: 'SET_PLAN_TILE_WIDTH', width: 100 }).planTileWidth
    ).toBe(280)
    expect(
      chatReducer(initialChatState, { type: 'SET_PLAN_TILE_WIDTH', width: 999 }).planTileWidth
    ).toBe(640)
    expect(
      chatReducer(initialChatState, { type: 'SET_PLAN_TILE_WIDTH', width: 420 }).planTileWidth
    ).toBe(420)
  })

  it('NEW_CHAT 가 계획 타일 상태(내용/가시성/폭)를 리셋', () => {
    const dirty = chatReducer(
      chatReducer(initialChatState, recv({ type: 'plan_review', data: REVIEW })),
      { type: 'SET_PLAN_TILE_WIDTH', width: 500 }
    )
    expect(dirty.planContent).toBe(REVIEW.plan)
    const fresh = chatReducer(dirty, { type: 'NEW_CHAT' })
    expect(fresh.planTileOpen).toBe(false)
    expect(fresh.planContent).toBeNull()
    expect(fresh.planTileWidth).toBe(360)
  })

  it('승인 흐름(RESOLVE_PLAN + SET_PERMISSION_MODE) — 카드 제거 + 모드를 acceptEdits 로 전환', () => {
    // approvePlan 이 dispatch 하는 두 액션의 결합 효과: 계획 카드는 사라지고 권한 모드는
    // plan → acceptEdits 로 전환되어 다음 턴이 plan 모드로 재진입(ExitPlanMode 재호출)하지 않는다.
    const withPlan = chatReducer(initialChatState, recv({ type: 'plan_review', data: REVIEW }))
    expect(withPlan.permissionMode).toBe('plan')
    const resolved = chatReducer(withPlan, { type: 'RESOLVE_PLAN' })
    const approved = chatReducer(resolved, { type: 'SET_PERMISSION_MODE', mode: 'acceptEdits' })
    expect(approved.pendingPlanReview).toBeNull()
    expect(approved.permissionMode).toBe('acceptEdits')
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
