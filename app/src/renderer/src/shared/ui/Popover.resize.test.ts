import { createElement, type ComponentProps } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom } from './renderHarness.testfixture'
import { Popover } from './Popover'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./renderHarness.testfixture')).fakeHooks
}))
vi.mock('react-dom', async () => (await import('./renderHarness.testfixture')).fakeReactDom)
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('remeasures an open panel when its content resizes and disconnects on close', () => {
  vi.useFakeTimers()
  let resize: () => void = () => {}
  const observe = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe = observe
      disconnect = disconnect
    }
  )
  let width = 100
  const dom = installFakeDom({
    innerWidth: 400,
    innerHeight: 500,
    layout: (node) => ({
      rect:
        node.props.id === 'anchor'
          ? { left: 280, top: 300, width: 40, height: 30 }
          : { left: 0, top: 0, width, height: 100 }
    })
  })
  const anchorRef = {
    current: dom.createNode('button', { id: 'anchor' }) as unknown as HTMLButtonElement
  }
  dom.render(
    createElement(
      Popover,
      { open: true, anchorRef, onClose: vi.fn() } as unknown as ComponentProps<typeof Popover>,
      'rows'
    )
  )
  const panel = dom.query('[role="menu"]')!
  expect(observe).toHaveBeenCalledWith(panel)
  expect(panel.props.style).toMatchObject({ left: 280 })
  width = 300
  dom.act(resize)
  expect(panel.props.style).toMatchObject({ left: 92 })
  dom.act(resize)
  expect(panel.props.style).toMatchObject({ left: 92 })
  dom.unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})
