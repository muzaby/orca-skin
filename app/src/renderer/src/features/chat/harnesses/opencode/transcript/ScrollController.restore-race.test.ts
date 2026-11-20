import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ScrollAnchor } from '../../common/transcript/scrollTypes'
import { OpenCodeScrollController } from './ScrollController'
import { timelineViewState } from './viewState'
import { createBlockList } from '../../../lib/transcript/blockList'
import { TranscriptViewport } from '../../../components/transcript/TranscriptViewport'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async () => ({
  useVirtualizer: (await import('../../../components/transcript/viewportTestBridge.testfixture'))
    .useRealVirtualizerWithFakeHooks
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
    let top = 0
    let rowOffset = 300
    dom = installFakeDom({
      innerWidth: 1200,
      innerHeight: 900,
      layout: (node) => {
        const isHeader = node.getAttribute('data-transcript-header') !== null
        const start = isHeader ? -top : rowOffset - top
        return { rect: { left: 0, top: start, width: 600, height: isHeader ? rowOffset : 50 } }
      }
    })
    vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
    const observers = new Map<Element, ResizeObserverCallback>()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(element: Element): void {
          observers.set(element, this.callback)
        }
        disconnect = vi.fn()
      }
    )
    const writes: number[] = []
    const events = new EventTarget()
    const viewport = {
      dataset: {} as Record<string, string>,
      scrollHeight: 1000,
      clientHeight: 200,
      clientWidth: 600,
      get scrollTop() {
        return top
      },
      set scrollTop(value: number) {
        top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight))
        writes.push(top)
      },
      getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, width: 600, height: 200 }),
      querySelectorAll: (selector: string) => dom!.queryAll(selector),
      querySelector: (selector: string) => dom!.query(selector),
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events)
    }
    const content = dom.createNode('div') as unknown as HTMLDivElement
    const blocks = createBlockList([{ key: 'row' }]).snapshot()
    const header = createElement('div', null, 'preceding history')
    const notifyResize = (element: Element, height: number): void => {
      const size = [{ blockSize: height, inlineSize: viewport.clientWidth }]
      observers.get(element)!(
        [
          {
            target: element,
            contentRect: element.getBoundingClientRect(),
            borderBoxSize: size,
            contentBoxSize: size,
            devicePixelContentBoxSize: size
          }
        ],
        {} as ResizeObserver
      )
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
        scroll.contentRef.current = content
        return createElement(TranscriptViewport<{ key: string }>, {
          snapshot: blocks,
          scrollRef: scroll.scrollRef,
          isPinned: scroll.isPinned,
          header,
          renderBlock: (block) => createElement('p', { 'data-timeline-key': block.key }, 'reading')
        })
      }
    }
    dom.render(createElement(OpenCodeScrollController, props))
    const reading = dom.query('[data-timeline-key="row"]')!
    Object.assign(reading, { dataset: { timelineKey: reading.getAttribute('data-timeline-key') } })
    expect(viewport.scrollTop).toBe(200)
    const scrollEvent = (): void => {
      events.dispatchEvent(new Event('scroll'))
      controls.onScroll()
    }
    dom.act(scrollEvent)
    dom.frame()
    // Streaming output grows below the reading position; the restore frame is queued.
    viewport.scrollHeight += 100
    if (order === 'resize-first') notifyResize(content, viewport.scrollHeight)
    // The reader scrolls down 40px before that frame runs.
    dom.act(() => {
      viewport.scrollTop = 240
      scrollEvent()
    })
    writes.length = 0
    if (order === 'scroll-first') notifyResize(content, viewport.scrollHeight)
    dom.frame()
    expect(viewport.scrollTop).toBe(240)
    expect(state.top).toBe(240)
    expect(writes).toEqual([])
    // Later growth above the row still restores the new anchor, not the old one.
    const before = reading.getBoundingClientRect().top
    rowOffset += 60
    viewport.scrollHeight += 60
    notifyResize(content, viewport.scrollHeight)
    notifyResize(dom.query('[data-transcript-header]') as unknown as Element, rowOffset)
    dom.frame()
    expect(viewport.scrollTop).toBe(300)
    expect(reading.getBoundingClientRect().top).toBe(before)
    expect(writes).toEqual([300])
  }
)
