import { describe, expect, it, vi } from 'vitest'
import { createIdleCloseTimer, createStallTimer, STALL_TIMEOUT_MS } from './timers'

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

  it('IdleCloseTimer is a P1 no-op stub', () => {
    const timer = createIdleCloseTimer()
    expect(() => timer.reset()).not.toThrow()
    expect(() => timer.clear()).not.toThrow()
  })
})
