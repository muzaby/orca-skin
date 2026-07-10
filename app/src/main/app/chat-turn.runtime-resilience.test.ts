import { describe, expect, it, vi } from 'vitest'
import { createStallTimer, STALL_TIMEOUT_MS } from '../features/chat/timers'
import { abortableDelay, RETRY_BACKOFF_MS } from '../features/chat/turn-coordinator'
import type { TurnContext } from '../contracts/turn'

function fakeTurn(): TurnContext {
  const controller = new AbortController()
  return { controller, live: { markAborted: vi.fn() } } as unknown as TurnContext
}

describe('send runtime resilience helpers', () => {
  it('idle timer 는 무응답 시간이 지나면 턴을 timeout abort 한다', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createStallTimer(turn)

    idle.reset()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS)

    expect(turn.live?.markAborted).toHaveBeenCalledWith('stall')
    expect(turn.controller.signal.aborted).toBe(true)
    idle.clear()
    vi.useRealTimers()
  })

  it('idle timer 는 이벤트 reset 마다 만료 시점을 연장한다', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createStallTimer(turn)

    idle.reset()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS - 1)
    idle.reset()
    vi.advanceTimersByTime(1)
    expect(turn.controller.signal.aborted).toBe(false)
    vi.advanceTimersByTime(STALL_TIMEOUT_MS)
    expect(turn.controller.signal.aborted).toBe(true)
    idle.clear()
    vi.useRealTimers()
  })

  it('beginPause 동안 무응답이 지나도 abort 하지 않는다 (승인 대기 보호)', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createStallTimer(turn)

    idle.reset()
    idle.beginPause()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS * 2)

    expect(turn.controller.signal.aborted).toBe(false)
    idle.clear()
    vi.useRealTimers()
  })

  it('보류 중에는 reset()이 타이머를 재무장하지 않는다 (동시 서브에이전트 이벤트 방어)', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createStallTimer(turn)

    idle.reset()
    idle.beginPause()
    // 다른 서브에이전트의 이벤트가 이벤트 루프에서 idle.reset()을 반복 호출하는 상황 시뮬레이션.
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(STALL_TIMEOUT_MS / 2)
      idle.reset()
    }
    vi.advanceTimersByTime(STALL_TIMEOUT_MS * 2)
    expect(turn.controller.signal.aborted).toBe(false)
    idle.clear()
    vi.useRealTimers()
  })

  it('마지막 release 후 다시 작동한다 (동시 N건은 refcount 로 마지막에만 재개)', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createStallTimer(turn)

    idle.reset()
    const releaseA = idle.beginPause()
    const releaseB = idle.beginPause()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS * 2)
    expect(turn.controller.signal.aborted).toBe(false)

    releaseA() // 아직 B 가 보류 중 — 재무장 안 함
    vi.advanceTimersByTime(STALL_TIMEOUT_MS * 2)
    expect(turn.controller.signal.aborted).toBe(false)

    releaseB() // 마지막 release — 재무장
    vi.advanceTimersByTime(STALL_TIMEOUT_MS)
    expect(turn.controller.signal.aborted).toBe(true)
    idle.clear()
    vi.useRealTimers()
  })

  it('release 는 idempotent — 중복 호출이 refcount 를 깨지 않는다', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createStallTimer(turn)

    const release1 = idle.beginPause()
    const release2 = idle.beginPause()
    release1()
    release1() // 중복 — 무시(refcount 1 유지)
    vi.advanceTimersByTime(STALL_TIMEOUT_MS * 2)
    expect(turn.controller.signal.aborted).toBe(false)
    release2()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS)
    expect(turn.controller.signal.aborted).toBe(true)
    idle.clear()
    vi.useRealTimers()
  })

  it('abortableDelay 는 retry backoff 중 abort 를 존중한다', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = abortableDelay(RETRY_BACKOFF_MS[0], controller.signal)

    controller.abort()
    await expect(pending).rejects.toThrow('Aborted')
    vi.useRealTimers()
  })
})
