import { describe, expect, it, vi } from 'vitest'
import { createStallTimer, STALL_TIMEOUT_MS } from './timers'
import type { AbortCause } from './session-state'

describe('StallTimer', () => {
  it('busy 상태에서 무이벤트 시간이 지나면 stall cause 로 abort 한다', () => {
    vi.useFakeTimers()
    const causes: AbortCause[] = []
    const timer = createStallTimer({ abort: (cause) => causes.push(cause) })

    timer.reset()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS)

    expect(causes).toEqual(['stall'])
    timer.clear()
    vi.useRealTimers()
  })

  it('pause 중에는 reset 이벤트가 들어와도 stall abort 를 재무장하지 않는다', () => {
    vi.useFakeTimers()
    const causes: AbortCause[] = []
    const timer = createStallTimer({ abort: (cause) => causes.push(cause) })

    timer.reset()
    const release = timer.beginPause()
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(STALL_TIMEOUT_MS)
      timer.reset()
    }
    expect(causes).toEqual([])

    release()
    vi.advanceTimersByTime(STALL_TIMEOUT_MS)
    expect(causes).toEqual(['stall'])
    timer.clear()
    vi.useRealTimers()
  })
})
