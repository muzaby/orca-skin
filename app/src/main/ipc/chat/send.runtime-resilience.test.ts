import { describe, expect, it, vi } from 'vitest'
import { abortableDelay, createIdleTimer, IDLE_TIMEOUT_MS, RETRY_BACKOFF_MS } from './send'
import type { InflightTurn } from './turn-registry'

function fakeTurn(): InflightTurn {
  const controller = new AbortController()
  return { controller, timedOut: false, cancelled: false } as unknown as InflightTurn
}

describe('send runtime resilience helpers', () => {
  it('idle timer 는 무응답 시간이 지나면 턴을 timeout abort 한다', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createIdleTimer(turn)

    idle.reset()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS)

    expect(turn.timedOut).toBe(true)
    expect(turn.controller.signal.aborted).toBe(true)
    idle.clear()
    vi.useRealTimers()
  })

  it('idle timer 는 이벤트 reset 마다 만료 시점을 연장한다', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createIdleTimer(turn)

    idle.reset()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1)
    idle.reset()
    vi.advanceTimersByTime(1)
    expect(turn.controller.signal.aborted).toBe(false)
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
    expect(turn.controller.signal.aborted).toBe(true)
    idle.clear()
    vi.useRealTimers()
  })

  it('idle timer 는 pause 동안 무응답이 지나도 abort 하지 않는다 (승인 대기 보호)', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createIdleTimer(turn)

    idle.reset()
    idle.pause()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2)

    expect(turn.controller.signal.aborted).toBe(false)
    idle.clear()
    vi.useRealTimers()
  })

  it('paused 중에는 reset()이 타이머를 재무장하지 않는다 (동시 서브에이전트 이벤트 방어)', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createIdleTimer(turn)

    idle.reset()
    idle.pause()
    // 다른 서브에이전트의 이벤트가 이벤트 루프에서 idle.reset()을 반복 호출하는 상황 시뮬레이션.
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS / 2)
      idle.reset()
    }
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2)
    expect(turn.controller.signal.aborted).toBe(false)
    idle.clear()
    vi.useRealTimers()
  })

  it('idle timer 는 resume 후 다시 작동한다', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createIdleTimer(turn)

    idle.reset()
    idle.pause()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2)
    expect(turn.controller.signal.aborted).toBe(false)

    idle.resume()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
    expect(turn.controller.signal.aborted).toBe(true)
    idle.clear()
    vi.useRealTimers()
  })

  it('idle timer 는 resume 이 새 만료 창을 연다 (이후 event reset 으로 연장 가능)', () => {
    vi.useFakeTimers()
    const turn = fakeTurn()
    const idle = createIdleTimer(turn)

    idle.reset()
    idle.pause()
    idle.resume()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1)
    idle.reset()
    vi.advanceTimersByTime(1)
    expect(turn.controller.signal.aborted).toBe(false)
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
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
