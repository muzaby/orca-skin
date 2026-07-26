import { describe, expect, it } from 'vitest'
import { BackgroundTaskTracker } from './background-tasks'

describe('BackgroundTaskTracker (0136)', () => {
  it('started 로 등록하고 ids 로 조회한다', () => {
    const t = new BackgroundTaskTracker()
    expect(t.ids('s1').size).toBe(0)
    t.started('s1', 'a1')
    t.started('s1', 'a2')
    expect([...t.ids('s1')].sort()).toEqual(['a1', 'a2'])
  })

  it('settled 는 해당 toolUseId 만 제거하고, 비면 세션 엔트리를 정리한다', () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    t.started('s1', 'a2')
    t.settled('s1', 'a1')
    expect([...t.ids('s1')]).toEqual(['a2'])
    t.settled('s1', 'a2')
    expect(t.ids('s1').size).toBe(0)
  })

  it('세션 격리 — 다른 세션의 태스크는 서로 영향 없다', () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    t.started('s2', 'b1')
    t.clear('s1')
    expect(t.ids('s1').size).toBe(0)
    expect([...t.ids('s2')]).toEqual(['b1'])
  })

  it('settled/clear 는 미등록 세션에 안전한 no-op', () => {
    const t = new BackgroundTaskTracker()
    expect(() => t.settled('nope', 'x')).not.toThrow()
    expect(() => t.clear('nope')).not.toThrow()
  })
})

describe('BackgroundTaskTracker.asyncLaunched (0143)', () => {
  it('markAsyncLaunched 로 background 확정 관측을 기록한다', () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    expect(t.isAsyncLaunched('s1', 'a1')).toBe(false)
    t.markAsyncLaunched('s1', 'a1')
    expect(t.isAsyncLaunched('s1', 'a1')).toBe(true)
  })

  it('재started(진행 갱신)가 관측 플래그를 리셋하지 않는다', () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    t.markAsyncLaunched('s1', 'a1')
    t.started('s1', 'a1')
    expect(t.isAsyncLaunched('s1', 'a1')).toBe(true)
  })

  it('영수증이 task_started 보다 먼저 와도(순서 역전) 등록 + 관측을 기록한다', () => {
    const t = new BackgroundTaskTracker()
    t.markAsyncLaunched('s1', 'a1')
    expect([...t.ids('s1')]).toEqual(['a1'])
    expect(t.isAsyncLaunched('s1', 'a1')).toBe(true)
  })

  it('settled 는 관측까지 함께 제거한다(해제 후 재settled 미부여의 근거)', () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    t.markAsyncLaunched('s1', 'a1')
    t.settled('s1', 'a1')
    expect(t.isAsyncLaunched('s1', 'a1')).toBe(false)
    expect(t.ids('s1').size).toBe(0)
  })

  it('미등록 조회는 false', () => {
    const t = new BackgroundTaskTracker()
    expect(t.isAsyncLaunched('nope', 'x')).toBe(false)
  })
})
