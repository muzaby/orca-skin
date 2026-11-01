import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ScrollAnchor } from '../../common/transcript/scrollTypes'
import { OpenCodeScrollController } from './ScrollController'
import { timelineViewState } from './viewState'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
// Context propagation is not implemented in the lightweight React harness.
// The real controller still owns every effect, DOM listener and callback.
vi.mock('./scrollContext', () => ({
  TimelineScrollContext: { Provider: ({ children }: { children: ReactNode }) => children }
}))

class RowElement {
  dataset = { timelineKey: 'row' }
  parentElement = null
  closest(): this {
    return this
  }
  getBoundingClientRect(): { top: number; bottom: number } {
    return { top: 100, bottom: 150 }
  }
}
let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('OpenCode controller document interaction', () => {
  it('captures the latest scroll once per frame and cancels the queued capture on unmount', () => {
    vi.useFakeTimers()
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {
          /* explicit fixture geometry */
        }
        disconnect(): void {
          /* no native observer */
        }
      }
    )
    const row = new RowElement()
    const measure = vi.fn(() => [row])
    const viewport = {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 200,
      getBoundingClientRect: () => ({ top: 0, bottom: 200 }),
      querySelectorAll: measure,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    let controls!: ScrollAnchor
    const state = timelineViewState('frame-coalescing')
    state.setPinned(false)
    const props: Parameters<typeof OpenCodeScrollController>[0] = {
      sessionKey: 'frame-coalescing',
      children: (scroll) => {
        controls = scroll
        scroll.scrollRef.current = viewport as unknown as HTMLDivElement
        scroll.contentRef.current = {} as HTMLDivElement
        return null
      }
    }
    dom.render(createElement(OpenCodeScrollController, props))
    measure.mockClear()
    dom.act(() => {
      for (const top of [10, 20, 30]) {
        viewport.scrollTop = top
        controls.onScroll()
      }
    })
    expect(measure).not.toHaveBeenCalled()
    dom.frame()
    expect(measure).toHaveBeenCalledTimes(1)
    expect(state.top).toBe(30)
    dom.act(() => {
      viewport.scrollTop = 40
      controls.onScroll()
    })
    dom.frame()
    expect(measure).toHaveBeenCalledTimes(2)
    expect(state.top).toBe(40)
    dom.act(() => {
      viewport.scrollTop = 50
      controls.onScroll()
    })
    dom.unmount()
    dom.frame()
    expect(measure).toHaveBeenCalledTimes(2)
    expect(state.top).toBe(50)
  })

  it('keeps jump-to-bottom pinned when an external click releases over a retained selection, then follows output', () => {
    vi.useFakeTimers()
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
    vi.stubGlobal('Element', RowElement)
    vi.stubGlobal('Node', RowElement)
    const row = new RowElement()
    Object.assign(document, {
      getSelection: () => ({ anchorNode: row, focusNode: row, isCollapsed: false })
    })
    let resize = (): void => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe(): void {
          // The test invokes the captured measurement callback explicitly.
        }
        disconnect = disconnect
      }
    )
    const viewportListeners = new Map<string, EventListener>()
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
      contains: (element: unknown) => element === row,
      addEventListener: (type: string, listener: EventListener) =>
        viewportListeners.set(type, listener),
      removeEventListener: (type: string) => viewportListeners.delete(type)
    }
    let controls!: ScrollAnchor
    const state = timelineViewState('external-pointer-regression')
    state.setPinned(true)
    const controllerProps: Parameters<typeof OpenCodeScrollController>[0] = {
      sessionKey: 'external-pointer-regression',
      children: (scroll) => {
        controls = scroll
        scroll.scrollRef.current = viewport as unknown as HTMLDivElement
        scroll.contentRef.current = {} as HTMLDivElement
        return null
      }
    }
    dom.render(createElement(OpenCodeScrollController, controllerProps))
    dom.act(() => {
      for (const listener of dom!.documentListeners.get('selectionchange') ?? []) listener({})
    })
    expect(state.pinned).toBe(false)
    dom.act(() => controls.scrollToBottom())
    expect(state.pinned).toBe(true)
    dom.act(() => {
      for (const listener of dom!.documentListeners.get('pointerup') ?? []) listener({ target: {} })
    })
    expect(state.pinned).toBe(true)
    viewport.scrollHeight += 100
    resize()
    dom.frame()
    expect(viewport.scrollTop).toBe(900)
    dom.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(viewportListeners.size).toBe(0)
    expect(dom.documentListeners.get('pointerup')?.size ?? 0).toBe(0)
    expect(dom.documentListeners.get('selectionchange')?.size ?? 0).toBe(0)
  })
})
