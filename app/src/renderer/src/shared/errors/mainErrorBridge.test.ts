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
    vi.stubGlobal('window', { oo: { log: { error: log } } })
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

  // 0324 EP-30 ③ — 인자를 생략하면 호출 때 `window.oo.error` 를 읽는다. `main.tsx` 가 `installOo()` 뒤에 불러야
  // 하는 이유다(설치 전이면 구독이 조용히 0 이다).
  it('인자를 생략하면 호출 때의 `window.oo.error` 에 구독하고 쌓인 보고를 읽는다 (EP-30 ③ 설치 뒤)', async () => {
    const onReport = vi.fn(() => () => {})
    const drain = vi.fn(async () => [])
    vi.stubGlobal('window', { oo: { error: { onReport, drain } } })
    await connectMainErrorReports()
    expect(onReport).toHaveBeenCalledTimes(1)
    expect(drain).toHaveBeenCalledTimes(1)
  })

  it('`window.oo` 가 생기기 전에 인자 없이 부르면 구독하지 않는다 — 순서가 결과를 바꾼다 (EP-30 ③ 설치 전)', async () => {
    const onReport = vi.fn(() => () => {})
    const drain = vi.fn(async () => [])
    const win: { oo?: unknown } = {}
    vi.stubGlobal('window', win)
    const disconnect = await connectMainErrorReports()
    win.oo = { error: { onReport, drain } }
    expect(disconnect).toBeTypeOf('function')
    expect(onReport).not.toHaveBeenCalled()
    expect(drain).not.toHaveBeenCalled()
  })
})
