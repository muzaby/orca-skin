import { describe, expect, it, vi } from 'vitest'
import {
  createIdleCloseTimer,
  createStallTimer,
  IDLE_CLOSE_TIMEOUT_MS,
  STALL_TIMEOUT_MS
} from './timers'

describe('lifecycle timers', () => {
  it('StallTimer aborts a busy turn after silence', () => {
    vi.useFakeTimers()
    const markAborted = vi.fn()
    const turn: Parameters<typeof createStallTimer>[0] = {
      controller: new AbortController(),
      live: {
        events: (async function* (events: never[]) {
          for (const ev of events) yield ev
        })([]),
        close: () => {},
        setPermissionMode: async () => {},
        interrupt: async () => {},
        setModel: async () => {},
        stopTask: async () => {},
        backgroundTask: async () => false,
        markAborted
      }
    }
    const timer = createStallTimer(turn)
    timer.reset()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS)
    expect(markAborted).toHaveBeenCalledWith('stall')
    expect(turn.controller.signal.aborted).toBe(true)
    timer.clear()
    vi.useRealTimers()
  })

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
