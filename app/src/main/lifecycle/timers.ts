import type { TurnContext } from './turn-context'
import { abortTurn } from './abort'

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

// live-idle 핸들 회수 타이머 기본 수명 — StallTimer(120s, busy 중 무이벤트)와 분리(decision ②).
// 트리거 조건이 정반대(busy 중 vs busy 아님)이므로 같은 'idle' 로 합치면 작업 중 핸들을 닫는 버그
// 클래스가 열린다. Persistent 전용이라 게이트 OFF(OneShot)에선 발동하지 않는다(handoff 0054).
export const IDLE_CLOSE_TIMEOUT_MS = 300_000

export interface IdleCloseTimer {
  reset: () => void
  clear: () => void
}

// IdleCloseTimer 실구현 — reset 으로 무장, 만료 시 onIdle() 1회 발동(자체 정리). clear 로 취소.
// onReap 콜백 주입으로 supervisor/pool 을 import 하지 않는다(L1 순환 회피, 0054).
export function createIdleCloseTimer(
  onIdle: () => void,
  timeoutMs: number = IDLE_CLOSE_TIMEOUT_MS
): IdleCloseTimer {
  let timer: ReturnType<typeof setTimeout> | null = null
  const clear = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  const reset = (): void => {
    clear()
    timer = setTimeout(() => {
      timer = null
      onIdle()
    }, timeoutMs)
  }
  return { reset, clear }
}
