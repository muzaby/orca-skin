import { APP_ERROR_PENDING_MAX, appErrorKey, type AppErrorReport } from '../../../shared/app-error'

export type ErrorReportSink = (windowId: number, report: AppErrorReport) => void

/** Electron-free delivery state. Only windows that installed their listener are ready. */
export class ErrorReportHub {
  private readonly ready = new Set<number>()
  private pending: AppErrorReport[] = []
  private readonly lastPublished = new Map<string, number>()
  private sink: ErrorReportSink = () => {}
  private forward: ((report: AppErrorReport) => void) | null = null

  constructor(private readonly now: () => number = Date.now) {}

  setSink(sink: ErrorReportSink): void {
    this.sink = sink
  }

  // 창이 붙지 않는 프로세스(에이전트 호스트)는 보고를 창에 주는 프로세스로 넘긴다 (0324 AC47).
  // 넘기는 동안 이 허브는 창 전달·보류를 하지 않는다 — 같은 보고가 두 번 가지 않게.
  setForward(forward: ((report: AppErrorReport) => void) | null): void {
    this.forward = forward
  }

  publish(report: AppErrorReport): void {
    const now = this.now()
    for (const [key, at] of this.lastPublished) {
      if (now - at >= 1000) this.lastPublished.delete(key)
    }
    const key = appErrorKey(report)
    if (this.lastPublished.has(key)) return
    this.lastPublished.set(key, now)
    if (this.forward) {
      this.forward(report)
      return
    }
    for (const id of this.ready) this.sink(id, report)
    // The sink may forget a window that died before its destroyed callback ran.
    if (this.ready.size === 0) {
      this.pending.push(report)
      if (this.pending.length > APP_ERROR_PENDING_MAX) this.pending.shift()
    }
  }

  markReady(id: number): AppErrorReport[] {
    this.ready.add(id)
    const pending = this.pending
    this.pending = []
    return pending
  }

  forget(id: number): void {
    this.ready.delete(id)
  }
}
