import { describe, expect, it, vi } from 'vitest'
import type { AppErrorReport } from '../../../shared/app-error'
import { ErrorReportHub } from './hub'

const report = (id: string, detail = id): AppErrorReport => ({
  id,
  title: 'unexpected',
  detail,
  origin: 'main'
})

describe('ErrorReportHub', () => {
  it('queues before readiness, drains once and drops the oldest after ten reports', () => {
    const hub = new ErrorReportHub()
    for (let i = 0; i < 11; i++) hub.publish(report(String(i)))
    expect(hub.markReady(1).map((r) => r.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1))
    )
    expect(hub.markReady(1)).toEqual([])
  })

  it('sends only to ready windows and returns to queueing after destruction', () => {
    const hub = new ErrorReportHub()
    const sink = vi.fn()
    hub.setSink(sink)
    hub.markReady(1)
    hub.markReady(2)
    hub.publish(report('a'))
    expect(sink.mock.calls).toEqual([
      [1, report('a')],
      [2, report('a')]
    ])
    hub.forget(1)
    hub.forget(2)
    hub.publish(report('b'))
    expect(sink).toHaveBeenCalledTimes(2)
    expect(hub.markReady(3)).toEqual([report('b')])
  })

  it('suppresses the same title/detail for 1000ms without extending the cooldown', () => {
    let now = 0
    const hub = new ErrorReportHub(() => now)
    const sink = vi.fn()
    hub.setSink(sink)
    hub.markReady(1)
    hub.publish(report('a', 'same'))
    now = 500
    hub.publish(report('b', 'same'))
    expect(sink).toHaveBeenCalledTimes(1)
    now = 1000
    hub.publish(report('c', 'same'))
    expect(sink).toHaveBeenCalledTimes(2)
  })

  it('retains a report when the last ready window disappears during send', () => {
    const hub = new ErrorReportHub()
    hub.markReady(1)
    hub.setSink((id) => hub.forget(id))
    hub.publish(report('lost-window'))
    expect(hub.markReady(2)).toEqual([report('lost-window')])
  })
})
