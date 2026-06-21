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

  it('abortableDelay 는 retry backoff 중 abort 를 존중한다', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = abortableDelay(RETRY_BACKOFF_MS[0], controller.signal)

    controller.abort()
    await expect(pending).rejects.toThrow('Aborted')
    vi.useRealTimers()
  })
})
