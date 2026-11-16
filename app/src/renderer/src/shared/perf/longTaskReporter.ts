// renderer 메인 스레드의 long task 보고 (0324 AC7). 브라우저가 알려 준 항목을 관측 창(1초)으로
// 묶어 `perf.stall` 1건(최댓값·개수)만 main 로그로 보낸다 — 전송은 단방향이라 응답을 기다리지 않는다.

import {
  STALL_EVENT,
  STALL_SCOPE,
  STALL_WINDOW_MS,
  createStallWindow
} from '../../../../shared/perf-budget'
import { rendererLog } from '../logging'

interface LongTaskReporterDeps {
  emit: (data: Record<string, unknown>) => void
  setTimer: (fn: () => void, ms: number) => unknown
}

// 항목 하나의 지속 시간(ms)을 받는 함수를 돌려준다. 창의 첫 항목이 타이머를 건다.
export function createLongTaskReporter(deps: LongTaskReporterDeps): (durationMs: number) => void {
  const window = createStallWindow()
  let armed = false
  return (durationMs) => {
    window.observe(durationMs)
    if (armed) return
    armed = true
    deps.setTimer(() => {
      armed = false
      const stall = window.flush()
      if (!stall) return
      deps.emit({
        thread: 'renderer',
        source: 'longtask',
        durationMs: Math.floor(stall.durationMs),
        severity: stall.severity,
        count: stall.count
      })
    }, STALL_WINDOW_MS)
  }
}

// `longtask` 관측을 켠다. 지원하지 않는 환경(테스트·옛 엔진)에서는 아무것도 하지 않는다.
export function startLongTaskReporter(): void {
  if (typeof PerformanceObserver === 'undefined') return
  if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return
  const report = createLongTaskReporter({
    emit: (data) => rendererLog.info(STALL_EVENT, STALL_SCOPE, data),
    setTimer: (fn, ms) => setTimeout(fn, ms)
  })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) report(entry.duration)
  }).observe({ entryTypes: ['longtask'] })
}
