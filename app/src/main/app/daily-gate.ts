import type { DailyGate } from '../features/gate'
import { createDayBoundary, type DayBoundaryDeps } from '../features/gate/daily'

export function startDailyGate(
  deps: Omit<DayBoundaryDeps, 'onDayChanged'> & {
    gate: Pick<DailyGate, 'lapseDay'>
    pushConnectionState(): void
    subscribeWake(check: () => void): () => void
  }
): { dispose(): void } {
  const boundary = createDayBoundary({
    now: deps.now,
    setTimer: deps.setTimer,
    clearTimer: deps.clearTimer,
    onDayChanged: () => {
      deps.gate.lapseDay()
      deps.pushConnectionState()
    }
  })
  boundary.start()
  const unsubscribe = deps.subscribeWake(boundary.check)
  return {
    dispose(): void {
      unsubscribe()
      boundary.dispose()
    }
  }
}
