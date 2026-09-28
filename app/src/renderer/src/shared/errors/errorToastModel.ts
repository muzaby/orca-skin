import type { AppErrorReport } from '../../../../shared/app-error'

export const ERROR_TOAST_MAX = 3
export const ERROR_TOAST_DURATION_MS = 4600
export const ERROR_TOAST_COOLDOWN_MS = 1000

export interface ErrorToast extends AppErrorReport {
  key: string
  seq: number
  lastHitAt: number
}

export function applyErrorReport(
  state: readonly ErrorToast[],
  report: AppErrorReport,
  now: number
): { state: readonly ErrorToast[]; expire: { id: string; at: number }[] } {
  const key = `${report.title}\0${report.detail ?? ''}`
  const existing = state.find((toast) => toast.key === key)
  if (existing) {
    if (now - existing.lastHitAt < ERROR_TOAST_COOLDOWN_MS) return { state, expire: [] }
    return {
      state: state.map((toast) =>
        toast === existing
          ? { ...toast, target: report.target, seq: toast.seq + 1, lastHitAt: now }
          : toast
      ),
      expire: [{ id: existing.id, at: now + ERROR_TOAST_DURATION_MS }]
    }
  }
  return {
    state: [{ ...report, key, seq: 0, lastHitAt: now }, ...state].slice(0, ERROR_TOAST_MAX),
    expire: [{ id: report.id, at: now + ERROR_TOAST_DURATION_MS }]
  }
}
