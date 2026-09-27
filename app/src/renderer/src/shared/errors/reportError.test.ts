import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorToastStore } from './errorToastStore'
import { presentErrorReport, reportError } from './reportError'
import { registerGlobalErrorHandlers } from './globalHandlers'

const log = vi.fn()
const originalPush = errorToastStore.getState().push
beforeEach(() => {
  vi.useFakeTimers()
  errorToastStore.setState({ push: originalPush })
  vi.stubGlobal('window', { orca: { log: { error: log } } })
  log.mockClear()
})
afterEach(() => {
  vi.restoreAllMocks()
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('renderer reporting', () => {
  it('logs first, truncates description, and leaves main reports unlogged', () => {
    const push = vi.spyOn(errorToastStore.getState(), 'push')
    reportError({
      event: 'chat.send.rejected',
      scope: 'chat',
      title: 'sendFailed',
      error: new Error('x'.repeat(400))
    })
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0])
    expect(errorToastStore.getState().toasts[0].detail).toBe('x'.repeat(299) + '…')
    presentErrorReport({ id: 'main', title: 'loadFailed', detail: 'main failure', origin: 'main' })
    expect(log).toHaveBeenCalledTimes(1)
    expect(errorToastStore.getState().toasts).toHaveLength(2)
  })
  it('supports explicit detail and null without revealing the exception message', () => {
    reportError({
      event: 'test.report.failed',
      scope: 'test',
      title: 'unexpected',
      error: 'hidden',
      detail: null
    })
    expect(errorToastStore.getState().toasts[0].detail).toBeUndefined()
    reportError({
      event: 'test.report.failed',
      scope: 'test',
      title: 'loadFailed',
      error: 'unused',
      detail: 'explicit'
    })
    expect(errorToastStore.getState().toasts[0].detail).toBe('explicit')
  })
  it('swallows presentation failures after logging once', () => {
    vi.spyOn(errorToastStore.getState(), 'push').mockImplementation(() => {
      throw new Error('UI failure')
    })
    expect(() =>
      reportError({
        event: 'test.report.failed',
        scope: 'test',
        title: 'unexpected',
        error: 'original'
      })
    ).not.toThrow()
    expect(log).toHaveBeenCalledTimes(1)
  })
  it('registers both global handlers, filters benign errors before logging, and cleans up', () => {
    const handlers = new Map<string, (event: unknown) => void>()
    Object.assign(window, {
      addEventListener: (type: string, fn: (event: unknown) => void) => handlers.set(type, fn),
      removeEventListener: (type: string) => handlers.delete(type)
    })
    const cleanup = registerGlobalErrorHandlers()
    for (const message of [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.'
    ])
      handlers.get('error')!({ message })
    expect(log).not.toHaveBeenCalled()
    expect(errorToastStore.getState().toasts).toEqual([])
    handlers.get('error')!({
      message: 'uncaught',
      error: new Error('uncaught'),
      filename: 'app.js',
      lineno: 10
    })
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toBe('renderer.uncaught.error')
    expect(errorToastStore.getState().toasts[0]).toMatchObject({
      title: 'unexpected',
      detail: 'uncaught'
    })
    handlers.get('unhandledrejection')!({ reason: new Error('rejected') })
    expect(log).toHaveBeenCalledTimes(2)
    expect(log.mock.calls[1][0]).toBe('renderer.unhandled.rejection')
    expect(errorToastStore.getState().toasts).toHaveLength(2)
    cleanup()
    expect(handlers.size).toBe(0)
  })
})
