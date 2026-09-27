import { APP_ERROR_PENDING_MAX, type AppErrorReport } from '../../../shared/app-error'

export type ErrorReportSink = (windowId: number, report: AppErrorReport) => void

/** Electron-free delivery state. Only windows that installed their listener are ready. */
export class ErrorReportHub {
  private readonly ready = new Set<number>()
  private pending: AppErrorReport[] = []
  private readonly lastPublished = new Map<string, number>()
  private sink: ErrorReportSink = () => {}

  constructor(private readonly now: () => number = Date.now) {}

  setSink(sink: ErrorReportSink): void {
    this.sink = sink
  }

  publish(report: AppErrorReport): void {
    const now = this.now()
    for (const [key, at] of this.lastPublished) {
      if (now - at >= 1000) this.lastPublished.delete(key)
    }
    const key = `${report.title}\0${report.detail ?? ''}`
    if (this.lastPublished.has(key)) return
    this.lastPublished.set(key, now)
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
