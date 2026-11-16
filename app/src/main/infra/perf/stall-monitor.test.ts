// 멈춤 판정 (0324 AC5 · MD-03) — 50ms 이상이면 long, 160ms 이상이면 severe, 관측 창 하나에 1건.

import { describe, expect, it } from 'vitest'
import { createStallMonitor, type StallRecord } from './stall-monitor'
import { stallSeverity } from '../../../shared/perf-budget'

function monitor(thread: 'main' | 'agent-host' = 'main'): {
  records: StallRecord[]
  window(...samples: number[]): void
} {
  const records: StallRecord[] = []
  let pending: number[] = []
  const tick = createStallMonitor({
    thread,
    drain: () => {
      const out = pending
      pending = []
      return out
    },
    record: (record) => records.push(record)
  })
  return {
    records,
    window(...samples: number[]) {
      pending = samples
      tick()
    }
  }
}

describe('createStallMonitor', () => {
  it.each([
    [49, null],
    [50, 'long'],
    [159, 'long'],
    [160, 'severe']
  ] as const)('지연 %dms → %s', (sample, severity) => {
    const m = monitor()
    m.window(sample)
    expect(stallSeverity(sample)).toBe(severity)
    expect(m.records).toEqual(
      severity === null ? [] : [{ thread: 'main', source: 'loop', durationMs: sample, count: 1 }]
    )
  })

  it('한 창에 표본이 셋이어도 기록은 최댓값 1건이다', () => {
    const m = monitor()
    m.window(70, 210, 55)
    expect(m.records).toEqual([{ thread: 'main', source: 'loop', durationMs: 210, count: 3 }])
  })

  it('예산 미만 표본은 개수에 세지 않는다', () => {
    const m = monitor()
    m.window(10, 80, 49)
    expect(m.records).toEqual([{ thread: 'main', source: 'loop', durationMs: 80, count: 1 }])
  })

  it('창은 서로 독립이다 — 앞 창의 최댓값이 다음 창에 남지 않는다', () => {
    const m = monitor()
    m.window(300)
    m.window(20)
    m.window(60)
    expect(m.records.map((r) => r.durationMs)).toEqual([300, 60])
  })

  it('스레드 이름을 기록에 싣는다', () => {
    const m = monitor('agent-host')
    m.window(120)
    expect(m.records[0]?.thread).toBe('agent-host')
  })
})
