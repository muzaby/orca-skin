import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppErrorReport } from '../../shared/app-error'
import { CHANNELS } from '../../shared/ipc'
import { errorReportHub, reportError } from '../infra/error-report'
import { setRootLogger } from '../infra/log/registry'
import { fakeClient } from '../infra/ipc/client.testfixture'
import { setIpcTransport, type IpcTransport, type InvokeListener } from '../infra/ipc/transport'
import { errorToastStore } from '../../renderer/src/shared/errors/errorToastStore'
import { connectMainErrorReports } from '../../renderer/src/shared/errors/mainErrorBridge'
import { installErrorReportSink } from './error-report-sink'
import { registerErrorHandlers } from './handlers/error'

vi.mock('../infra/log', () => ({ currentLogFilePath: vi.fn(), flushLogSync: vi.fn() }))

// 데이터 호스트의 전송과 같은 모양 — 핸들러 표와 지금 열린 창.
const handlers = new Map<string, InvokeListener>()
const sender = fakeClient(42)
const transport: IpcTransport = {
  handle: (channel, listener) => void handlers.set(channel, listener),
  on: () => {},
  clients: () => (sender.isClosed() ? [] : [sender]),
  primaryClient: () => sender
}

afterEach(() => {
  errorReportHub.forget(42)
  errorReportHub.markReady(99)
  errorReportHub.forget(99)
  setRootLogger(null)
  setIpcTransport(null)
  vi.unstubAllGlobals()
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
})

describe('main → IPC → renderer reporting', () => {
  it('drains an early report through the registered handler, delivers live reports, and forgets destroyed senders', async () => {
    const error = vi.fn()
    const log = { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: () => log }
    setRootLogger(log)
    const rendererLog = vi.fn()
    vi.stubGlobal('window', { oo: { log: { error: rendererLog } } })
    reportError({
      event: 'app.uncaught.exception',
      scope: 'app',
      title: 'unexpected',
      error: new Error('before ready'),
      target: { kind: 'page', path: '/plugins' }
    })
    expect(errorToastStore.getState().toasts).toEqual([])
    setIpcTransport(transport)
    installErrorReportSink()
    registerErrorHandlers()
    const handle = (event: { sender: typeof sender }): AppErrorReport[] =>
      handlers.get(CHANNELS.errorDrain)!(
        { sender: event.sender, trusted: true },
        undefined
      ) as AppErrorReport[]
    let onReport: ((r: AppErrorReport) => void) | undefined
    const send = vi.fn((report: AppErrorReport) => onReport?.(report))
    const original = sender.send
    sender.send = (channel, payload) => {
      expect(channel).toBe(CHANNELS.errorReportEvent)
      original(channel, payload)
      send(payload as AppErrorReport)
    }
    const disconnect = await connectMainErrorReports({
      onReport: (fn) => {
        onReport = fn
        return () => {
          onReport = undefined
        }
      },
      drain: async () => handle({ sender })
    })
    expect(errorToastStore.getState().toasts).toHaveLength(1)
    expect(errorToastStore.getState().toasts[0].detail).toBe('before ready')
    expect(errorToastStore.getState().toasts[0].target).toEqual({ kind: 'page', path: '/plugins' })
    expect(handle({ sender })).toEqual([])
    expect(sender.watchers()).toBe(1)
    reportError({
      event: 'app.unhandled.rejection',
      scope: 'app',
      title: 'unexpected',
      error: 'after ready',
      target: { kind: 'settings', tab: 'usage' }
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(errorToastStore.getState().toasts).toHaveLength(2)
    expect(send.mock.calls[0][0].target).toEqual({ kind: 'settings', tab: 'usage' })
    expect(errorToastStore.getState().toasts[0].target).toEqual({ kind: 'settings', tab: 'usage' })
    expect(error).toHaveBeenCalledTimes(2)
    expect(rendererLog).not.toHaveBeenCalled()
    sender.close()
    reportError({
      event: 'app.unhandled.rejection',
      scope: 'app',
      title: 'unexpected',
      error: 'after destroyed'
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(handle({ sender })[0].detail).toBe('after destroyed')
    disconnect()
  })
})
