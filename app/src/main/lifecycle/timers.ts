import type { InflightTurn } from './turn-context'

export const STALL_TIMEOUT_MS = 120_000
export const IDLE_TIMEOUT_MS = STALL_TIMEOUT_MS

export interface StallTimer {
  reset: () => void
  clear: () => void
  // 승인 카드처럼 "사용자를 기다리는" 구간을 refcount 로 감싼다.
  beginPause: () => () => void
}

export type IdleTimer = StallTimer

export function createStallTimer(turn: Pick<InflightTurn, 'abort'>): StallTimer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pauseDepth = 0
  const clear = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  const arm = (): void => {
    clear()
    timer = setTimeout(() => {
      turn.abort('stall')
    }, STALL_TIMEOUT_MS)
  }
  const reset = (): void => {
    if (pauseDepth > 0) return
    arm()
  }
  const beginPause = (): (() => void) => {
    pauseDepth += 1
    if (pauseDepth === 1) clear()
    let released = false
    return () => {
      if (released) return
      released = true
      pauseDepth -= 1
      if (pauseDepth === 0) arm()
    }
  }
  return { reset, clear, beginPause }
}

export function createIdleTimer(turn: Pick<InflightTurn, 'abort'>): IdleTimer {
  return createStallTimer(turn)
}

export interface IdleCloseTimer {
  reset: () => void
  clear: () => void
}

export function createIdleCloseTimer(): IdleCloseTimer {
  return {
    reset: () => {},
    clear: () => {}
  }
}
