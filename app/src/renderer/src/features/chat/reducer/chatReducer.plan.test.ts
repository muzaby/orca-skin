import { describe, it, expect } from 'vitest'
import { PANEL_DEFAULT_WIDTH, chatReducer, initialChatState } from './chatReducer'
import type { NormalizedEvent, PlanReviewRequest } from '../../../../../shared/ipc'

const REVIEW: PlanReviewRequest = { requestId: 'p1', plan: '# 계획\n- b.py 생성' }

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

// ExitPlanMode 는 permission.requested(action.kind='plan_review')로 도착한다(B2).
const planEvent = (): NormalizedEvent => ({
  type: 'permission.requested',
  approvalId: REVIEW.requestId,
  origin: 'agent',
  action: { kind: 'plan_review', request: REVIEW }
})

describe('chatReducer — 계획 검토(plan_review)', () => {
  it('기본값은 null', () => {
    expect(initialChatState.pendingPlanReview).toBeNull()
  })

  it('우측 패널 타일 기본값', () => {
    expect(initialChatState.rightPanelTiles).toEqual([])
    expect(initialChatState.rightPanelTileLabels).toEqual({})
    expect(initialChatState.planContent).toBeNull()
    expect(initialChatState.rightPanelColWidths).toEqual([])
    expect(PANEL_DEFAULT_WIDTH).toBe(360)
  })

  it('plan_review 이벤트가 pendingPlanReview + planContent 설정 + 계획 타일 자동 활성화', () => {
    const s = chatReducer(initialChatState, recv(planEvent()))
    expect(s.pendingPlanReview).toEqual(REVIEW)
    expect(s.planContent).toBe(REVIEW.plan)
    expect(s.rightPanelTiles).toEqual([['plan']])
  })

  it('RESOLVE_PLAN 은 게이트만 닫고 타일 내용/활성 상태는 유지(읽기전용)', () => {
    const withPlan = chatReducer(initialChatState, recv(planEvent()))
    const cleared = chatReducer(withPlan, { type: 'RESOLVE_PLAN' })
    expect(cleared.pendingPlanReview).toBeNull()
    expect(cleared.planContent).toBe(REVIEW.plan)
    expect(cleared.rightPanelTiles).toEqual([['plan']])
  })

  it('우측 패널 타일 toggle/set active 가 중복 없이 column-major 로 배치', () => {
    const plan = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' })
    expect(plan.rightPanelTiles).toEqual([['plan']])
    const subagent = chatReducer(plan, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'subagent',
      active: true
    })
    expect(subagent.rightPanelTiles).toEqual([['plan', 'subagent']])
    const duplicate = chatReducer(subagent, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'plan',
      active: true
    })
    expect(duplicate.rightPanelTiles).toEqual([['plan', 'subagent']])
    const closed = chatReducer(duplicate, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'plan',
      active: false
    })
    expect(closed.rightPanelTiles).toEqual([['subagent']])
  })

  it('0열 하단 타일 제거 시 다른 열로 리플로우되지 않는다(사용자 사례)', () => {
    // 0열[plan,subagent] / 1열[reserved1] 구성
    let s = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' })
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'subagent', active: true })
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'reserved1', active: true })
    expect(s.rightPanelTiles).toEqual([['plan', 'subagent'], ['reserved1']])
    // 0열 2행(subagent) 제거 → 0열[plan] / 1열[reserved1] (reserved1 이 0열로 합쳐지지 않음)
    const removed = chatReducer(s, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'subagent' })
    expect(removed.rightPanelTiles).toEqual([['plan'], ['reserved1']])
  })

  it('열이 비면 열 인덱스 키 폭/행분할도 splice 된다', () => {
    // 0열[plan] / 1열[subagent], 각 열 폭 설정
    let s = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' })
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'subagent', active: true })
    // subagent 를 1열로 분리: 0열을 꽉 채우지 않았으므로 toggle 로 두 번째 열 만들기 위해 reserved1 추가 후 정리
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'reserved1', active: true })
    // 상태: 0열[plan,subagent] / 1열[reserved1]
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 0, width: 300 })
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 1, width: 500 })
    expect(s.rightPanelColWidths).toEqual([300, 500])
    // 1열의 유일 타일(reserved1) 제거 → 1열 드롭, 폭 인덱스1도 제거
    const removed = chatReducer(s, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'reserved1' })
    expect(removed.rightPanelTiles).toEqual([['plan', 'subagent']])
    expect(removed.rightPanelColWidths).toEqual([300])
  })

  it('이름 변경/삭제가 라벨 오버라이드와 활성 목록을 갱신', () => {
    const active = chatReducer(initialChatState, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'reserved1',
      active: true
    })
    const renamed = chatReducer(active, {
      type: 'RENAME_RIGHT_PANEL_TILE',
      id: 'reserved1',
      label: '메모'
    })
    expect(renamed.rightPanelTileLabels.reserved1).toBe('메모')
    const removed = chatReducer(renamed, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'reserved1' })
    expect(removed.rightPanelTiles).toEqual([])
    expect(removed.rightPanelTileLabels.reserved1).toBeUndefined()
  })

  it('열 폭과 행 분할을 clamp', () => {
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 0, width: 100 })
        .rightPanelColWidths[0]
    ).toBe(280)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 0, width: 999 })
        .rightPanelColWidths[0]
    ).toBe(640)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 0, width: 420 })
        .rightPanelColWidths[0]
    ).toBe(420)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_ROW_SPLIT', col: 0, frac: 0.1 })
        .rightPanelRowSplits[0]
    ).toBe(0.2)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_ROW_SPLIT', col: 0, frac: 0.9 })
        .rightPanelRowSplits[0]
    ).toBe(0.8)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_ROW_SPLIT', col: 0, frac: 0.5 })
        .rightPanelRowSplits[0]
    ).toBe(0.5)
  })

  it('NEW_CHAT 가 계획 타일 상태(내용/활성/레이아웃)를 리셋', () => {
    const dirty = chatReducer(chatReducer(initialChatState, recv(planEvent())), {
      type: 'SET_RIGHT_PANEL_COL_WIDTH',
      col: 0,
      width: 500
    })
    expect(dirty.planContent).toBe(REVIEW.plan)
    const fresh = chatReducer(dirty, { type: 'NEW_CHAT' })
    expect(fresh.rightPanelTiles).toEqual([])
    expect(fresh.planContent).toBeNull()
    expect(fresh.rightPanelColWidths).toEqual([])
  })

  it('승인 흐름(RESOLVE_PLAN + SET_PERMISSION_MODE) — 카드 제거 + 모드를 acceptEdits 로 전환', () => {
    const withPlan = chatReducer(initialChatState, recv(planEvent()))
    expect(withPlan.permissionMode).toBe('plan')
    const resolved = chatReducer(withPlan, { type: 'RESOLVE_PLAN' })
    const approved = chatReducer(resolved, { type: 'SET_PERMISSION_MODE', mode: 'accept_edits' })
    expect(approved.pendingPlanReview).toBeNull()
    expect(approved.permissionMode).toBe('accept_edits')
  })

  it('CANCEL_CHAT / error / NEW_CHAT 가 카드를 비운다', () => {
    const withPlan = chatReducer(initialChatState, recv(planEvent()))
    expect(chatReducer(withPlan, { type: 'CANCEL_CHAT' }).pendingPlanReview).toBeNull()
    expect(chatReducer(withPlan, { type: 'NEW_CHAT' }).pendingPlanReview).toBeNull()
    expect(
      chatReducer(
        withPlan,
        recv({
          type: 'error',
          error: { category: 'schema_validation_error', message: 'x', retryable: false }
        })
      ).pendingPlanReview
    ).toBeNull()
  })
})
