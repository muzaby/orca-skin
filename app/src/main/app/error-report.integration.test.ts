import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppErrorReport } from '../../shared/app-error'
import { CHANNELS } from '../../shared/ipc'
import { errorReportHub, reportError } from '../infra/error-report'
import { setRootLogger } from '../infra/log/registry'
import { errorToastStore } from '../../renderer/src/shared/errors/errorToastStore'
import { connectMainErrorReports } from '../../renderer/src/shared/errors/mainErrorBridge'
import { installErrorReportSink } from './error-report-sink'
import { registerErrorHandlers } from './handlers/error'

const electron = vi.hoisted(() => ({ handle: vi.fn(), fromId: vi.fn() }))
vi.mock('electron', () => ({
  ipcMain: { handle: electron.handle },
  shell: {},
  webContents: { fromId: electron.fromId }
}))
vi.mock('../infra/log', () => ({ currentLogFilePath: vi.fn(), flushLogSync: vi.fn() }))

afterEach(() => {
  errorReportHub.forget(42)
  errorReportHub.markReady(99)
  errorReportHub.forget(99)
  setRootLogger(null)
  vi.unstubAllGlobals()
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
})

describe('main → IPC → renderer reporting', () => {
  it('drains an early report through the registered handler, delivers live reports, and forgets destroyed senders', async () => {
    const error = vi.fn()
    const log = { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: () => log }
    setRootLogger(log)
    const rendererLog = vi.fn()
    vi.stubGlobal('window', { orca: { log: { error: rendererLog } } })
    reportError({
      event: 'app.uncaught.exception',
      scope: 'app',
      title: 'unexpected',
      error: new Error('before ready'),
      target: { kind: 'page', path: '/plugins' }
    })
    expect(errorToastStore.getState().toasts).toEqual([])
    installErrorReportSink()
    registerErrorHandlers()
    const handle = electron.handle.mock.calls.find(
      ([channel]) => channel === CHANNELS.errorDrain
    )![1]
    let onReport: ((r: AppErrorReport) => void) | undefined
    const sender = { id: 42, once: vi.fn() }
    const send = vi.fn((channel, report) => {
      expect(channel).toBe(CHANNELS.errorReportEvent)
      onReport?.(report)
    })
    electron.fromId.mockReturnValue({ isDestroyed: () => false, send })
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
    expect(sender.once).toHaveBeenCalledTimes(1)
    reportError({
      event: 'app.unhandled.rejection',
      scope: 'app',
      title: 'unexpected',
      error: 'after ready',
      target: { kind: 'settings', tab: 'usage' }
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(errorToastStore.getState().toasts).toHaveLength(2)
    expect(send.mock.calls[0][1].target).toEqual({ kind: 'settings', tab: 'usage' })
    expect(errorToastStore.getState().toasts[0].target).toEqual({ kind: 'settings', tab: 'usage' })
    expect(error).toHaveBeenCalledTimes(2)
    expect(rendererLog).not.toHaveBeenCalled()
    sender.once.mock.calls[0][1]()
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
