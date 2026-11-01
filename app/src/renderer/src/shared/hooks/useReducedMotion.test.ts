import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../ui/renderHarness.testfixture'
import { useReducedMotion } from './useReducedMotion'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../ui/renderHarness.testfixture')).fakeHooks
}))
let dom: FakeDom | undefined
afterEach(() => { dom?.unmount(); vi.unstubAllGlobals() })

it('reads the motion preference, follows changes and releases its listener', () => {
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
  const callbacks = new Set<() => void>()
  const query = { matches: false, addEventListener: vi.fn((_name: string, listener: () => void) => callbacks.add(listener)), removeEventListener: vi.fn((_name: string, listener: () => void) => callbacks.delete(listener)) }
  window.matchMedia = vi.fn(() => query as unknown as MediaQueryList)
  let reduced: boolean | undefined
  function Consumer(): null { reduced = useReducedMotion(); return null }
  dom.render(createElement(Consumer))
  expect(reduced).toBe(false)
  dom.act(() => { query.matches = true; for (const notify of callbacks) notify() })
  expect(reduced).toBe(true)
  dom.act(() => { query.matches = false; for (const notify of callbacks) notify() })
  expect(reduced).toBe(false)
  dom.unmount()
  expect(callbacks.size).toBe(0)
  expect(query.removeEventListener).toHaveBeenCalledTimes(1)
})
