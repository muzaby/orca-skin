// long task 묶음 보고 (0324 AC7) — 1초 창에 항목이 여럿이어도 emit 은 1건이다.

import { describe, expect, it } from 'vitest'
import { createLongTaskReporter } from './longTaskReporter'

function harness(): {
  emitted: Array<Record<string, unknown>>
  timers: Array<{ fn: () => void; ms: number }>
  report: (durationMs: number) => void
  closeWindow(): void
} {
  const emitted: Array<Record<string, unknown>> = []
  const timers: Array<{ fn: () => void; ms: number }> = []
  const report = createLongTaskReporter({
    emit: (data) => emitted.push(data),
    setTimer: (fn, ms) => timers.push({ fn, ms })
  })
  return {
    emitted,
    timers,
    report,
    // 걸려 있는 창 하나를 닫는다.
    closeWindow() {
      timers.shift()!.fn()
    }
  }
}

describe('createLongTaskReporter', () => {
  it('1초 안의 항목 5개는 최댓값·개수를 실은 emit 1건이 된다', () => {
    const h = harness()
    for (const ms of [60, 220, 75, 51, 90]) h.report(ms)
    expect(h.timers.map((t) => t.ms)).toEqual([1000])
    expect(h.emitted).toEqual([])
    h.closeWindow()
    expect(h.emitted).toEqual([
      { thread: 'renderer', source: 'longtask', durationMs: 220, severity: 'severe', count: 5 }
    ])
  })

  it('창이 닫힌 뒤의 항목은 새 창으로 간다', () => {
    const h = harness()
    h.report(60)
    h.closeWindow()
    h.report(70)
    h.report(80)
    expect(h.timers).toHaveLength(1)
    h.closeWindow()
    expect(h.emitted.map((e) => [e.durationMs, e.count, e.severity])).toEqual([
      [60, 1, 'long'],
      [80, 2, 'long']
    ])
  })

  it('예산 미만 항목만 있던 창은 emit 하지 않는다', () => {
    const h = harness()
    h.report(49)
    h.closeWindow()
    expect(h.emitted).toEqual([])
  })
})
