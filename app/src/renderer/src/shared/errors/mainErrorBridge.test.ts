import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppErrorReport } from '../../../../shared/app-error'
import { errorToastStore } from './errorToastStore'
import { connectMainErrorReports } from './mainErrorBridge'

afterEach(() => {
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
  vi.unstubAllGlobals()
})

describe('main error bridge', () => {
  it('subscribes before drain so reports arriving during drain are not lost or logged twice', async () => {
    const log = vi.fn()
    vi.stubGlobal('window', { orca: { log: { error: log } } })
    let listener: ((r: AppErrorReport) => void) | undefined
    const order: string[] = []
    const pending: AppErrorReport = {
      id: 'pending',
      title: 'unexpected',
      detail: 'boot',
      origin: 'main'
    }
    const live: AppErrorReport = { id: 'live', title: 'saveFailed', detail: 'live', origin: 'main' }
    const unsubscribe = vi.fn()
    const disconnect = await connectMainErrorReports({
      onReport: (fn) => {
        order.push('subscribe')
        listener = fn
        return unsubscribe
      },
      drain: async () => {
        order.push('drain')
        listener?.(live)
        listener?.(pending)
        return [pending]
      }
    })
    expect(order).toEqual(['subscribe', 'drain'])
    expect(errorToastStore.getState().toasts.map((t) => [t.id, t.seq])).toEqual([
      ['pending', 0],
      ['live', 0]
    ])
    expect(log).not.toHaveBeenCalled()
    disconnect()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('is harmless in preview without a preload API', async () => {
    expect(await connectMainErrorReports(undefined)).toBeTypeOf('function')
    expect(errorToastStore.getState().toasts).toEqual([])
  })
})
