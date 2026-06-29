import { describe, expect, it, vi } from 'vitest'
import { createIdleCloseTimer, createStallTimer, STALL_TIMEOUT_MS } from './timers'

describe('lifecycle timers', () => {
  it('StallTimer aborts a busy turn after silence', () => {
    vi.useFakeTimers()
    const turn = { controller: new AbortController(), timedOut: false }
    const timer = createStallTimer(turn)
    timer.reset()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS)
    expect(turn.timedOut).toBe(true)
    expect(turn.controller.signal.aborted).toBe(true)
    timer.clear()
    vi.useRealTimers()
  })

  it('IdleCloseTimer is a P1 no-op stub', () => {
    const timer = createIdleCloseTimer()
    expect(() => timer.reset()).not.toThrow()
    expect(() => timer.clear()).not.toThrow()
  })
})
