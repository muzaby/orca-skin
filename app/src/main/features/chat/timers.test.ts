import { describe, expect, it, vi } from 'vitest'
import { createStallTimer, STALL_TIMEOUT_MS } from './timers'

describe('StallTimer', () => {
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
})
