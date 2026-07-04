import { describe, expect, it, vi } from 'vitest'
import { createIdleCloseTimer, IDLE_CLOSE_TIMEOUT_MS } from './idle-close-timer'

describe('IdleCloseTimer', () => {
  it('IdleCloseTimer fires onIdle once after the timeout', () => {
    vi.useFakeTimers()
    const onIdle = vi.fn()
    const timer = createIdleCloseTimer(onIdle, 1000)
    timer.reset()
    vi.advanceTimersByTime(999)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('IdleCloseTimer clear cancels a pending fire; reset re-arms from zero', () => {
    vi.useFakeTimers()
    const onIdle = vi.fn()
    const timer = createIdleCloseTimer(onIdle, 1000)
    timer.reset()
    vi.advanceTimersByTime(900)
    timer.clear()
    vi.advanceTimersByTime(5000)
    expect(onIdle).not.toHaveBeenCalled()
    // 재무장 후 다시 만료해야 1회 발동(reset 이 0 부터 다시 잰다)
    timer.reset()
    vi.advanceTimersByTime(1000)
    expect(onIdle).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('IdleCloseTimer defaults to IDLE_CLOSE_TIMEOUT_MS when no timeout given', () => {
    vi.useFakeTimers()
    const onIdle = vi.fn()
    const timer = createIdleCloseTimer(onIdle)
    timer.reset()
    vi.advanceTimersByTime(IDLE_CLOSE_TIMEOUT_MS - 1)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
    timer.clear()
    vi.useRealTimers()
  })
})
