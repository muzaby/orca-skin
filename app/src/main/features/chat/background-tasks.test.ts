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

// 0204 — 중단 확정 대기. completed/failed/stopped 는 전부 settled 로 수렴하므로 종료 상태별
// 분기를 두지 않는다. polling 이 아니라 tracker 구독으로만 종료를 안다(D-011).
describe('BackgroundTaskTracker.waitForTask (0204)', () => {
  it('SDK 정착(settled)에 resolve 한다 — task_notification completed 경로', async () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    const waiting = t.waitForTask('s1', 'a1', { timeoutMs: 1_000 })
    t.settled('s1', 'a1')
    await expect(waiting).resolves.toBe('settled')
  })

  it('세션 전체 정리(clear)에도 resolve 한다 — 채널 사망·앱 종료 합성 정착 경로', async () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    const waiting = t.waitForTask('s1', 'a1', { timeoutMs: 1_000 })
    t.clear('s1')
    await expect(waiting).resolves.toBe('settled')
  })

  it('이미 추적에 없으면 즉시 settled — 정착이 먼저 관측된 경합에서 걸리지 않는다', async () => {
    const t = new BackgroundTaskTracker()
    await expect(t.waitForTask('s1', 'gone', { timeoutMs: 1_000 })).resolves.toBe('settled')
  })

  it('확정이 오지 않으면 timeout 을 돌려준다 — watchdog 의 입력', async () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    await expect(t.waitForTask('s1', 'a1', { timeoutMs: 5 })).resolves.toBe('timeout')
  })

  it('다른 세션·다른 태스크의 정착에는 깨어나지 않는다', async () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    t.started('s1', 'a2')
    t.started('s2', 'a1')
    const waiting = t.waitForTask('s1', 'a1', { timeoutMs: 20 })
    t.settled('s2', 'a1')
    t.settled('s1', 'a2')
    await expect(waiting).resolves.toBe('timeout')
  })

  it('resolve 후 구독을 해제한다 — 대기가 끝난 뒤 리스너가 남지 않는다', async () => {
    const t = new BackgroundTaskTracker()
    t.started('s1', 'a1')
    const waiting = t.waitForTask('s1', 'a1', { timeoutMs: 1_000 })
    t.settled('s1', 'a1')
    await waiting
    // 남은 리스너가 있으면 이후 변경에서 다시 불린다 — 재시작/재정착으로 확인한다.
    t.started('s1', 'a1')
    t.settled('s1', 'a1')
    await expect(t.waitForTask('s1', 'a1', { timeoutMs: 5 })).resolves.toBe('settled')
  })
})
