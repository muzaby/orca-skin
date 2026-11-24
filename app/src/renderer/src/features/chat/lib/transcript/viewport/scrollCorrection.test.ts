import { writeScrollTop } from '../../../components/transcript/TranscriptViewport'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { beginCorrection, cancelCorrection, noteCorrectionLayout } from './scrollCorrection'

const frame = (): void => {
  vi.advanceTimersByTime(16)
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) =>
    setTimeout(() => fn(performance.now()), 16)
  )
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('restarts two quiet frames on measurements and anchor writes and grants ownership per element', () => {
  const el = { scrollTop: 0 } as HTMLElement
  const other = { scrollTop: 0 } as HTMLElement
  const settled = vi.fn()
  beginCorrection(el, settled)
  frame()
  noteCorrectionLayout(el)
  writeScrollTop(el, 80, undefined, 'opencode')
  expect(el.scrollTop).toBe(0)
  writeScrollTop(other, 81, undefined, 'opencode')
  expect(other.scrollTop).toBe(81)
  frame()
  writeScrollTop(el, 39, undefined, 'anchor')
  frame()
  writeScrollTop(el, 85, undefined, 'virtualizer')
  expect(el.scrollTop).toBe(39)
  expect(settled).not.toHaveBeenCalled()
  frame()
  expect(settled).toHaveBeenCalledOnce()
  writeScrollTop(el, 50, undefined, 'claude')
  expect(el.scrollTop).toBe(50)
})
it('cancels synchronously and drops a stale settle callback on reentry', () => {
  const el = { scrollTop: 0 } as HTMLElement
  const old = vi.fn()
  const current = vi.fn()
  beginCorrection(el, old)
  cancelCorrection(el)
  writeScrollTop(el, 7)
  expect(el.scrollTop).toBe(7)
  beginCorrection(el, current)
  frame()
  frame()
  expect(current).toHaveBeenCalledOnce()
  expect(old).not.toHaveBeenCalled()
})
