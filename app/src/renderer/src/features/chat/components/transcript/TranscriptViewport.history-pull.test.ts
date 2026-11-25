import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { createBlockList } from '../../lib/transcript/blockList'
import { TranscriptViewport } from './TranscriptViewport'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async () => ({
  useVirtualizer: (await import('./viewportTestBridge.testfixture')).useRealVirtualizerWithFakeHooks
}))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('common wheel listener for the three harnesses', () => {
  it.each([true, false])(
    'reserves the browser default only for a consumed partial-history pull (partial=%s)',
    (partial) => {
      vi.useFakeTimers()
      dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
      vi.stubGlobal('Element', class {})
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 16)
      )
      vi.stubGlobal('cancelAnimationFrame', clearTimeout)
      const events = new EventTarget()
      const scroller = Object.assign(events, {
        scrollTop: 0,
        clientHeight: 200,
        scrollHeight: 600,
        clientWidth: 400,
        querySelectorAll: () => [],
        getBoundingClientRect: () => ({ top: 0, height: 200, width: 400 })
      })
      const register = vi.spyOn(scroller, 'addEventListener')
      const request = vi.fn(() => true)
      const snapshot = createBlockList<{ key: string }>([]).snapshot()
      dom.render(
        createElement(TranscriptViewport, {
          snapshot,
          sessionKey: 's',
          scrollRef: { current: scroller as unknown as HTMLDivElement },
          history: partial ? { before: 'ready', after: 'ready', request } : undefined,
          footer: createElement('div', { 'data-live-footer': 'active' }),
          renderBlock: () => null
        })
      )
      expect(Boolean(dom.query('[data-history-edge="after"]'))).toBe(partial)
      expect(Boolean(dom.query('[data-live-footer="active"]'))).toBe(!partial)
      expect(register.mock.calls.find(([type]) => type === 'wheel')?.[2]).toEqual({
        passive: !partial
      })
      function wheel(deltaY: number, timeStamp: number): boolean {
        const event = new Event('wheel', { cancelable: true })
        Object.defineProperties(event, {
          deltaY: { value: deltaY },
          timeStamp: { value: timeStamp }
        })
        scroller.dispatchEvent(event)
        return event.defaultPrevented
      }
      expect(wheel(-5, 10)).toBe(partial)
      scroller.scrollTop = 80
      expect(wheel(-5, 45)).toBe(partial)
      expect(wheel(-5, 255)).toBe(false)
      expect(wheel(10, 265)).toBe(false)
      expect(request.mock.calls.length).toBe(partial ? 1 : 0)
    }
  )
})
