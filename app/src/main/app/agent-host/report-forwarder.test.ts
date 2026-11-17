import { describe, expect, it, vi } from 'vitest'
import { APP_ERROR_PENDING_MAX, type AppErrorReport } from '../../../shared/app-error'
import type { BootReport } from '../../../shared/ipc'
import { ErrorReportHub } from '../../infra/error-report/hub'
import { createReportForwarder } from './report-forwarder'

const report = (detail: string): AppErrorReport => ({
  id: `id-${detail}`,
  title: 'saveFailed',
  detail,
  origin: 'main'
})

const boot: BootReport = {
  startedAt: 10,
  finishedAt: 30,
  durationMs: 20,
  status: 'warning',
  steps: [
    {
      id: 'harness-install',
      status: 'warning',
      critical: false,
      startedAt: 10,
      finishedAt: 30,
      durationMs: 20,
      message: 'x'
    }
  ],
  warnings: ['harness-install: x']
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(connected = true) {
  const state = { connected }
  const sent: Array<[string, unknown]> = []
  const listeners = new Set<() => void>()
  const hub = new ErrorReportHub(() => 0)
  const sink = vi.fn()
  hub.setSink(sink)
  hub.markReady(1)
  const forwarder = createReportForwarder({
    hub,
    notify: (method, payload) => {
      if (!state.connected) return false
      sent.push([method, payload])
      return true
    },
    onConnected: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  })
  const connect = (): void => {
    state.connected = true
    for (const listener of listeners) listener()
  }
  return { state, sent, hub, sink, forwarder, connect, listeners }
}

describe('에이전트 호스트의 보고 전달 (AC47)', () => {
  it('오류 보고 1건과 부팅 보고 1건을 피어 통지 각 1건으로 보낸다', () => {
    const { sent, hub, sink, forwarder } = setup()
    hub.publish(report('a'))
    forwarder.bootFinished(boot)
    expect(sent).toEqual([
      ['report.error', report('a')],
      ['report.boot', boot]
    ])
    // 넘기는 동안 이 프로세스의 창 전달은 0이다 — 같은 보고가 두 번 가지 않는다.
    expect(sink).not.toHaveBeenCalled()
  })

  it('피어가 없는 동안의 오류 보고는 상한까지 보관했다가 연결되면 부팅 보고 뒤에 순서대로 보낸다', () => {
    const { sent, hub, forwarder, connect } = setup(false)
    for (let i = 0; i <= APP_ERROR_PENDING_MAX; i += 1) hub.publish(report(`e${i}`))
    forwarder.bootFinished(boot)
    expect(sent).toEqual([])
    connect()
    expect(sent[0]).toEqual(['report.boot', boot])
    // 가장 오래된 1건이 밀려난다.
    expect(sent.slice(1).map(([, payload]) => (payload as AppErrorReport).detail)).toEqual(
      Array.from({ length: APP_ERROR_PENDING_MAX }, (_, i) => `e${i + 1}`)
    )
    connect()
    // 다시 연결되면 부팅 보고만 다시 간다 — 보낸 오류 보고는 되풀이하지 않는다.
    expect(sent.slice(1 + APP_ERROR_PENDING_MAX)).toEqual([['report.boot', boot]])
  })

  it('부팅이 끝나기 전의 연결은 부팅 보고를 보내지 않는다', () => {
    const { sent, connect } = setup(false)
    connect()
    expect(sent).toEqual([])
  })

  it('멈추면 허브가 다시 자기 창에 전달하고 연결 구독을 푼다', () => {
    const { sent, hub, sink, forwarder, listeners } = setup()
    forwarder.stop()
    hub.publish(report('after'))
    expect(sent).toEqual([])
    expect(sink).toHaveBeenCalledExactlyOnceWith(1, report('after'))
    expect(listeners.size).toBe(0)
  })
})
