import type { TurnContext } from './turn-context'
import { abortTurn } from './supervisor'

export const STALL_TIMEOUT_MS = 120_000

export interface StallTimer {
  reset: () => void
  clear: () => void
  beginPause: () => () => void
}

export function createStallTimer(turn: Pick<TurnContext, 'live' | 'controller'>): StallTimer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pauseDepth = 0
  const clear = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  const arm = (): void => {
    clear()
    timer = setTimeout(() => abortTurn(turn, 'stall'), STALL_TIMEOUT_MS)
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

export interface IdleCloseTimer {
  reset: () => void
  clear: () => void
}

export function createIdleCloseTimer(): IdleCloseTimer {
  return { reset: () => {}, clear: () => {} }
}
