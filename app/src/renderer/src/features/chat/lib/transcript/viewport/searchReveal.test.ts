import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { revealSearchRow } from './searchReveal'

class ElementStub extends EventTarget {
  top = 0
  hidden = false
  scrollTop = 0
  tabIndex = 0
  attrs = new Map<string, string>()
  closest = (): ElementStub | null => (this.hidden ? this : null)
  getBoundingClientRect = (): { top: number; bottom: number; height: number } => ({
    top: this.top,
    bottom: this.top + 100,
    height: 100
  })
  getAttribute = (name: string): string | null => this.attrs.get(name) ?? null
  setAttribute = (name: string, value: string): void => {
    this.attrs.set(name, value)
  }
  removeAttribute = (name: string): void => {
    this.attrs.delete(name)
  }
  focus = vi.fn()
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { activeElement: null, body: {} }))
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn, 16))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('search hit visibility clock', () => {
  it.each([true, false])(
    'starts the two-second outline only on a visible frame (keyboard=%s)',
    (keyboard) => {
      const root = new ElementStub(),
        row = new ElementStub()
      const announce = vi.fn()
      row.top = 400
      row.hidden = true
      const finished = vi.fn()
      const stop = revealSearchRow(
        root as unknown as HTMLElement,
        { seq: 1, target: 'm', keyboard, restore: false },
        () => row as unknown as HTMLElement,
        () => {
          row.top = 0
        },
        announce,
        finished
      )
      vi.advanceTimersByTime(2016)
      expect(row.attrs.size).toBe(0)
      row.hidden = false
      vi.advanceTimersByTime(16)
      expect(announce).not.toHaveBeenCalled()
      vi.advanceTimersByTime(16)
      expect(announce).toHaveBeenCalledOnce()
      expect(row.focus).toHaveBeenCalledTimes(Number(keyboard))
      vi.advanceTimersByTime(1999)
      expect(row.attrs.has('data-history-highlight')).toBe(true)
      vi.advanceTimersByTime(1)
      expect(row.attrs.has('data-history-highlight')).toBe(false)
      expect(finished).toHaveBeenCalledOnce()
      stop()
    }
  )
  it('user input or restoring a visit leaves no focus, outline, or stale callback', () => {
    const root = new ElementStub(),
      row = new ElementStub()
    const announce = vi.fn()
    for (const restore of [true, false]) {
      const stop = revealSearchRow(
        root as unknown as HTMLElement,
        { seq: 1, target: 'm', keyboard: true, restore },
        () => row as unknown as HTMLElement,
        vi.fn(),
        announce
      )
      if (!restore) root.dispatchEvent(new Event('wheel'))
      vi.advanceTimersByTime(3000)
      expect(announce).not.toHaveBeenCalled()
      expect(row.focus).not.toHaveBeenCalled()
      expect(row.attrs.size).toBe(0)
      stop()
    }
  })
})
