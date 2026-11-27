import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { createBlockList } from '../../lib/transcript/blockList'
import * as searchReveal from '../../lib/transcript/viewport/searchReveal'
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
      class Nested {
        scrollTop = 0
        scrollHeight = 140
        clientHeight = 60
        parentElement = null
      }
      vi.stubGlobal('Element', Nested)
      vi.stubGlobal('getComputedStyle', () => ({ overflowY: 'auto' }))
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
      const snapshot = createBlockList([
        { key: 'grouped-work', partKeys: ['target:text'] }
      ]).snapshot()
      const row = { querySelector: () => null }
      Object.assign(scroller, {
        querySelector: (selector: string) =>
          selector === '[data-block-key="grouped-work"]' ? row : null
      })
      vi.stubGlobal('CSS', { escape: (s: string) => s })
      const reveal = vi
        .spyOn(searchReveal, 'revealSearchRow')
        .mockImplementation((_root, _selection, locate) => {
          expect(locate()).toBe(row)
          return () => undefined
        })
      dom.render(
        createElement(TranscriptViewport, {
          snapshot,
          search: { seq: 1, target: 'target', keyboard: false, restore: false },
          sessionKey: 's',
          scrollRef: { current: scroller as unknown as HTMLDivElement },
          history: partial ? { before: 'ready', after: 'ready', request } : undefined,
          footer: createElement('div', { 'data-live-footer': 'active' }),
          renderBlock: () => null
        })
      )
      expect(reveal).toHaveBeenCalledOnce()
      const announce = reveal.mock.calls[0][4]
      // A target starts at the old scrollTop. Only its positioned head can request a page.
      scroller.dispatchEvent(new Event('scroll'))
      expect(request).not.toHaveBeenCalled()
      announce()
      scroller.dispatchEvent(new Event('scroll'))
      expect(request).toHaveBeenCalledTimes(partial ? 1 : 0)
      request.mockClear()
      reveal.mockRestore()
      expect(Boolean(dom.query('[data-history-edge="after"]'))).toBe(partial)
      expect(Boolean(dom.query('[data-live-footer="active"]'))).toBe(!partial)
      expect(register.mock.calls.find(([type]) => type === 'wheel')?.[2]).toEqual({
        passive: !partial
      })
      function wheel(deltaY: number, timeStamp: number, target?: Nested): boolean {
        const event = new Event('wheel', { cancelable: true })
        Object.defineProperties(event, {
          deltaY: { value: deltaY },
          timeStamp: { value: timeStamp }
        })
        if (target) Object.defineProperty(event, 'target', { value: target })
        scroller.dispatchEvent(event)
        return event.defaultPrevented
      }
      expect(wheel(-5, 10)).toBe(partial)
      scroller.scrollTop = 80
      expect(wheel(-5, 45)).toBe(partial)
      expect(wheel(-5, 255)).toBe(false)
      expect(wheel(10, 265)).toBe(false)
      expect(request.mock.calls.length).toBe(partial ? 1 : 0)
      if (partial) {
        scroller.scrollTop = 0
        const nested = new Nested()
        nested.scrollTop = 40
        expect(wheel(-5, 510, nested)).toBe(false)
        expect(request).toHaveBeenCalledTimes(1)
        nested.scrollTop = 0
        expect(wheel(-5, 810, nested)).toBe(true)
        expect(request).toHaveBeenCalledTimes(2)
        request.mockReturnValueOnce(false)
        expect(wheel(-5, 1110)).toBe(false)
        expect(request).toHaveBeenCalledTimes(3)
        for (const repeat of [false, true]) {
          const key = Object.assign(new Event('keydown', { cancelable: true }), {
            key: 'PageUp',
            repeat
          })
          scroller.dispatchEvent(key)
          expect(key.defaultPrevented).toBe(!repeat)
        }
        expect(request).toHaveBeenCalledTimes(4)
        expect(request).toHaveBeenLastCalledWith('before')
      }
    }
  )
})
