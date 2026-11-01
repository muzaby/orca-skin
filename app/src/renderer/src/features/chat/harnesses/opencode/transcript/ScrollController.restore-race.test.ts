import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ScrollAnchor } from '../../common/transcript/scrollTypes'
import { OpenCodeScrollController } from './ScrollController'
import { timelineViewState } from './viewState'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('./scrollContext', () => ({
  TimelineScrollContext: { Provider: ({ children }: { children: unknown }) => children }
}))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it.each(['resize-first', 'scroll-first'] as const)(
  'preserves the latest user scroll with %s frame ordering',
  (order) => {
    vi.useFakeTimers()
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
    let resize = (): void => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe(): void {
          /* explicit resize callback */
        }
        disconnect(): void {
          /* no native observer */
        }
      }
    )
    let top = 0
    const viewport = {
      dataset: {} as Record<string, string>,
      scrollHeight: 1000,
      clientHeight: 200,
      get scrollTop() {
        return top
      },
      set scrollTop(value: number) {
        top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight))
      },
      getBoundingClientRect: () => ({ top: 0, bottom: 200 }),
      querySelectorAll: () => [row],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    // A transcript row at content offset 300 — its viewport position follows scrollTop.
    let rowOffset = 300
    const row = {
      dataset: { timelineKey: 'row' },
      parentElement: null,
      closest() {
        return this
      },
      getBoundingClientRect: () => ({ top: rowOffset - top, bottom: rowOffset + 50 - top })
    }
    let controls!: ScrollAnchor
    const state = timelineViewState(`scroll-race-${order}`)
    state.setPinned(false)
    state.setTop(200)
    const props = {
      sessionKey: `scroll-race-${order}`,
      children: (scroll: ScrollAnchor) => {
        controls = scroll
        scroll.scrollRef.current = viewport as unknown as HTMLDivElement
        scroll.contentRef.current = {} as HTMLDivElement
        return null
      }
    }
    dom.render(createElement(OpenCodeScrollController, props))
    expect(viewport.scrollTop).toBe(200)
    dom.act(() => controls.onScroll())
    dom.frame()
    // Streaming output grows below the reading position; the restore frame is queued.
    viewport.scrollHeight += 100
    if (order === 'resize-first') resize()
    // The reader scrolls down 40px before that frame runs.
    dom.act(() => {
      viewport.scrollTop = 240
      controls.onScroll()
    })
    if (order === 'scroll-first') resize()
    dom.frame()
    expect(viewport.scrollTop).toBe(240)
    expect(state.top).toBe(240)
    // Later growth above the row still restores the new anchor, not the old one.
    rowOffset += 60
    resize()
    dom.frame()
    expect(viewport.scrollTop).toBe(300)
  }
)
