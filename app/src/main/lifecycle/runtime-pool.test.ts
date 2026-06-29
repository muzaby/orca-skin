import { describe, expect, it, vi } from 'vitest'
import { RuntimePool } from './runtime-pool'
import type { ManagedRuntime } from './ports'
import type { SessionRuntimeState } from './session-state'

// 풀이 의존하는 것은 ManagedRuntime 의 close()/state 뿐 — 나머지 RuntimeLiveTurn 표면은 미사용.
function fakeRuntime(state: SessionRuntimeState = 'live'): ManagedRuntime & { closed: number } {
  const rt = {
    closed: 0,
    state,
    reusable: true,
    close(): void {
      rt.closed += 1
      rt.state = 'closed'
    }
  }
  return rt as unknown as ManagedRuntime & { closed: number }
}

describe('RuntimePool (0054)', () => {
  it('keepIdle 보존 후 같은 세션 키로 take 하면 동일 핸들을 돌려주고 타이머는 발동하지 않는다', () => {
    vi.useFakeTimers()
    const pool = new RuntimePool(1000)
    const rt = fakeRuntime()
    expect(pool.keepIdle('s1', rt)).toBe(true)
    expect(pool.size).toBe(1)

    const got = pool.take('s1')
    expect(got).toBe(rt)
    expect(pool.size).toBe(0)
    // take 가 타이머를 정지했으므로 만료 시각이 지나도 close/reap 없음.
    vi.advanceTimersByTime(5000)
    expect(rt.closed).toBe(0)
    vi.useRealTimers()
  })

  it('idle 만료 시 runtime.close() + drop + onReap 콜백', () => {
    vi.useFakeTimers()
    const pool = new RuntimePool(1000)
    const onReap = vi.fn()
    const rt = fakeRuntime()
    pool.keepIdle('s1', rt, onReap)
    vi.advanceTimersByTime(1000)
    expect(rt.closed).toBe(1)
    expect(onReap).toHaveBeenCalledTimes(1)
    expect(pool.size).toBe(0)
    expect(pool.take('s1')).toBeUndefined()
    vi.useRealTimers()
  })

  it('take(null) 과 미보유 키는 undefined', () => {
    const pool = new RuntimePool()
    expect(pool.take(null)).toBeUndefined()
    expect(pool.take('nope')).toBeUndefined()
  })

  it('sessionId 가 없으면 keepIdle 은 보존하지 않는다(false)', () => {
    const pool = new RuntimePool()
    const rt = fakeRuntime()
    expect(pool.keepIdle(null, rt)).toBe(false)
    expect(pool.size).toBe(0)
  })

  it('보관 중 핸들이 외부에서 closed 면 take 는 정리 후 undefined', () => {
    const pool = new RuntimePool()
    const rt = fakeRuntime()
    pool.keepIdle('s1', rt)
    rt.close() // 외부 close (state → closed)
    expect(pool.take('s1')).toBeUndefined()
    expect(pool.size).toBe(0)
  })

  it('같은 키에 다른 핸들을 keepIdle 하면 이전 핸들을 close 하고 교체한다', () => {
    const pool = new RuntimePool()
    const a = fakeRuntime()
    const b = fakeRuntime()
    pool.keepIdle('s1', a)
    pool.keepIdle('s1', b)
    expect(a.closed).toBe(1)
    expect(pool.take('s1')).toBe(b)
  })

  it('closeAll 은 모든 idle 핸들을 close 하고 비운다', () => {
    const pool = new RuntimePool()
    const a = fakeRuntime()
    const b = fakeRuntime()
    pool.keepIdle('a', a)
    pool.keepIdle('b', b)
    pool.closeAll()
    expect(a.closed).toBe(1)
    expect(b.closed).toBe(1)
    expect(pool.size).toBe(0)
  })
})
