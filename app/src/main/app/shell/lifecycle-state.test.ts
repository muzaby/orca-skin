// 수명 상태 (0324 EP-11 규칙 칸 · AC28).

import { describe, expect, it, vi } from 'vitest'
import { LifecycleEventSchema, type LifecycleEvent } from '../../../shared/host-protocol'
import { LifecycleState } from './lifecycle-state'

const ev = (type: LifecycleEvent['type'], sessionId: string): LifecycleEvent => ({
  type,
  sessionId
})

function fixture(events: LifecycleEvent[] = []): { state: LifecycleState; changes: () => number } {
  const state = new LifecycleState()
  for (const event of events) state.apply(event)
  const listener = vi.fn()
  state.onChange(listener)
  return { state, changes: () => listener.mock.calls.length }
}

describe('LifecycleState', () => {
  it('턴 시작 2 · 종료 1 → 활성 턴 1, 끝난 세션만 비활성이다', () => {
    const { state } = fixture([
      ev('turn.started', 'a'),
      ev('turn.started', 'b'),
      ev('turn.ended', 'a')
    ])
    expect(state.activeTurnCount()).toBe(1)
    expect(state.hasActiveTurns()).toBe(true)
    expect(state.isActive('a')).toBe(false)
    expect(state.isActive('b')).toBe(true)
  })

  it('같은 세션의 턴 시작이 겹쳐도 활성 턴은 하나이고 다시 알리지 않는다', () => {
    const { state, changes } = fixture([ev('turn.started', 'a')])
    state.apply(ev('turn.started', 'a'))
    expect(state.activeTurnCount()).toBe(1)
    expect(changes()).toBe(0)
  })

  it('승인 대기는 그 세션에만 표시되고 그 세션의 턴 종료가 지운다', () => {
    const { state } = fixture([
      ev('turn.started', 'a'),
      ev('turn.started', 'b'),
      ev('approval.pending', 'a')
    ])
    expect(state.isAwaitingApproval('a')).toBe(true)
    expect(state.isAwaitingApproval('b')).toBe(false)

    state.apply(ev('turn.ended', 'b'))
    expect(state.isAwaitingApproval('a')).toBe(true)

    state.apply(ev('turn.ended', 'a'))
    expect(state.isAwaitingApproval('a')).toBe(false)
    expect(state.hasActiveTurns()).toBe(false)
  })

  it('세션 종료는 그 세션의 모든 표시를 지우고 다른 세션은 그대로 둔다', () => {
    const { state } = fixture([
      ev('turn.started', 'a'),
      ev('approval.pending', 'a'),
      ev('harness.exited', 'c'),
      ev('turn.started', 'b')
    ])
    state.apply(ev('session.ended', 'a'))
    state.apply(ev('session.ended', 'c'))
    expect(state.isActive('a')).toBe(false)
    expect(state.isAwaitingApproval('a')).toBe(false)
    expect(state.hasFailed('c')).toBe(false)
    expect(state.isActive('b')).toBe(true)
  })

  it('하네스 종료는 그 세션을 비활성으로 만들고 오류로 표시한다', () => {
    const { state } = fixture([
      ev('turn.started', 'a'),
      ev('approval.pending', 'a'),
      ev('turn.started', 'b')
    ])
    state.apply(ev('harness.exited', 'a'))
    expect(state.isActive('a')).toBe(false)
    expect(state.isAwaitingApproval('a')).toBe(false)
    expect(state.hasFailed('a')).toBe(true)
    expect(state.hasFailed('b')).toBe(false)
    expect(state.activeTurnCount()).toBe(1)
  })

  it('오류 표시는 그 세션의 다음 턴 시작이 지운다', () => {
    const { state } = fixture([ev('harness.exited', 'a')])
    state.apply(ev('turn.started', 'a'))
    expect(state.hasFailed('a')).toBe(false)
    expect(state.isActive('a')).toBe(true)
  })

  it('호스트 종료는 전체를 비운다', () => {
    const { state, changes } = fixture([
      ev('turn.started', 'a'),
      ev('approval.pending', 'b'),
      ev('harness.exited', 'c')
    ])
    state.clear()
    expect(state.activeTurnCount()).toBe(0)
    expect(state.isAwaitingApproval('b')).toBe(false)
    expect(state.hasFailed('c')).toBe(false)
    expect(changes()).toBe(1)
    state.clear()
    expect(changes()).toBe(1)
  })

  it('모르는 세션의 턴 종료·세션 종료는 변화가 없다', () => {
    const { state, changes } = fixture([ev('turn.started', 'a')])
    state.apply(ev('turn.ended', 'zz'))
    state.apply(ev('session.ended', 'zz'))
    expect(state.activeTurnCount()).toBe(1)
    expect(changes()).toBe(0)
  })

  it('상태가 바뀔 때마다 구독자에게 알리고 해제하면 알리지 않는다', () => {
    const state = new LifecycleState()
    const listener = vi.fn()
    const off = state.onChange(listener)
    state.apply(ev('turn.started', 'a'))
    state.apply(ev('approval.pending', 'a'))
    state.apply(ev('approval.pending', 'a'))
    state.apply(ev('turn.ended', 'a'))
    expect(listener).toHaveBeenCalledTimes(3)
    off()
    state.apply(ev('turn.started', 'a'))
    expect(listener).toHaveBeenCalledTimes(3)
  })
})

describe('LifecycleEventSchema', () => {
  it.each(['turn.started', 'turn.ended', 'approval.pending', 'session.ended', 'harness.exited'])(
    '%s 를 받는다',
    (type) => {
      expect(LifecycleEventSchema.parse({ type, sessionId: 's' })).toEqual({ type, sessionId: 's' })
    }
  )

  it('모르는 종류와 빈 세션 id 는 거부한다', () => {
    expect(LifecycleEventSchema.safeParse({ type: 'turn.paused', sessionId: 's' }).success).toBe(
      false
    )
    expect(LifecycleEventSchema.safeParse({ type: 'turn.started', sessionId: '' }).success).toBe(
      false
    )
  })
})
