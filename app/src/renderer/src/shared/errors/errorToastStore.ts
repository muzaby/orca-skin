import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AppErrorReport } from '../../../../shared/app-error'
import { applyErrorReport, type ErrorToast } from './errorToastModel'

interface ErrorToastState {
  toasts: readonly ErrorToast[]
  push(report: AppErrorReport): void
  dismiss(id: string): void
}

export function createErrorToastStore(): StoreApi<ErrorToastState> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const clear = (id: string): void => {
    clearTimeout(timers.get(id))
    timers.delete(id)
  }
  return createStore<ErrorToastState>((set, get) => ({
    toasts: [],
    push: (report) => {
      const now = Date.now()
      const result = applyErrorReport(get().toasts, report, now)
      if (result.state === get().toasts) return
      for (const id of timers.keys()) {
        if (!result.state.some((toast) => toast.id === id)) clear(id)
      }
      for (const expiry of result.expire) {
        clear(expiry.id)
        timers.set(
          expiry.id,
          setTimeout(() => get().dismiss(expiry.id), expiry.at - now)
        )
      }
      set({ toasts: result.state })
    },
    dismiss: (id) => {
      clear(id)
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
    }
  }))
}

export const errorToastStore = createErrorToastStore()
