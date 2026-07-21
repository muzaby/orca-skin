import { describe, expect, it } from 'vitest'
import { BackgroundTaskTracker, isAsyncLaunchResult } from './background-tasks'

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

describe('isAsyncLaunchResult (0136)', () => {
  it('async_launched 상태 객체를 인식한다', () => {
    expect(isAsyncLaunchResult({ status: 'async_launched', agentId: 'a1' })).toBe(true)
  })

  it('완료/실패/원시값은 false', () => {
    expect(isAsyncLaunchResult({ status: 'completed' })).toBe(false)
    expect(isAsyncLaunchResult('최종 보고')).toBe(false)
    expect(isAsyncLaunchResult(null)).toBe(false)
    expect(isAsyncLaunchResult(undefined)).toBe(false)
  })
})
