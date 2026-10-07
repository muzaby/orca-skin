import type { AuthSnapshot } from '../../contracts/auth'

export interface DailyMark {
  readonly revision: number
  readonly verified: boolean
}

export function localDayKey(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function msUntilNextLocalMidnight(ms: number): number {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - ms
}

export function dailyReloginRequired(
  mark: DailyMark | undefined,
  snapshot: Pick<AuthSnapshot, 'status' | 'verified'>,
  loginRevision: number | undefined
): boolean {
  return (
    mark !== undefined &&
    !(
      snapshot.status === 'valid' &&
      snapshot.verified &&
      ((loginRevision ?? -1) > mark.revision || !mark.verified)
    )
  )
}

export interface DayBoundaryDeps {
  now(): number
  setTimer(callback: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
  onDayChanged(): void
}

export function createDayBoundary(deps: DayBoundaryDeps): {
  start(): void
  check(): void
  dispose(): void
} {
  let active = false
  let disposed = false
  let day = ''
  let timer: unknown
  let hasTimer = false
  const schedule = (): void => {
    if (hasTimer) deps.clearTimer(timer)
    timer = deps.setTimer(check, Math.max(1, msUntilNextLocalMidnight(deps.now())))
    hasTimer = true
  }
  const check = (): void => {
    if (!active) return
    const nextDay = localDayKey(deps.now())
    try {
      if (nextDay !== day) {
        day = nextDay
        deps.onDayChanged()
      }
    } finally {
      if (active) schedule()
    }
  }
  return {
    start(): void {
      if (active || disposed) return
      active = true
      day = localDayKey(deps.now())
      schedule()
    },
    check,
    dispose(): void {
      disposed = true
      active = false
      if (hasTimer) deps.clearTimer(timer)
      hasTimer = false
    }
  }
}
