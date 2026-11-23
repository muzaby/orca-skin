import { createElement, type RefObject } from 'react'
import { expect, it, vi } from 'vitest'
import { Virtualizer, type VirtualizerOptions } from '@tanstack/virtual-core'
import { dom } from './virtualView.testfixture'
import { useVirtualRows } from './useVirtualRows'

const state = vi.hoisted(() => ({ offset: 0 }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async (original) => ({
  ...(await original<typeof import('@tanstack/react-virtual')>()),
  useVirtualizer: (options: VirtualizerOptions<HTMLDivElement, Element>) =>
    new Virtualizer({
      ...options,
      initialRect: { width: 600, height: 100 },
      initialOffset: state.offset
    })
}))

it.each([
  ['u1 first virtual window', 50000, 0, undefined],
  ['u2 last virtual window', 50000, 999900, undefined],
  ['u4 full small file', 400, 0, 'all'],
  ['u5 distant file', 50000, 0, 'hidden'],
  ['u6 empty list', 0, 0, undefined]
] as const)('%s uses the supplied scroll owner and bounded rows', (_, count, offset, mode) => {
  state.offset = offset
  const owner: RefObject<HTMLDivElement | null> = { current: null }
  let rows: number[] = []
  let getOwner: () => HTMLDivElement | null = () => null
  function Probe(): React.JSX.Element {
    const list = useVirtualRows(count, owner, owner, mode)
    rows = list.getVirtualItems().map((item) => item.index)
    getOwner = list.options.getScrollElement
    return createElement('div', { ref: owner })
  }
  dom.render(createElement(Probe))
  expect(owner.current).toBeTruthy()
  expect(getOwner()).toBe(owner.current)
  if (mode === 'all') expect(rows).toEqual(Array.from({ length: count }, (_, index) => index))
  else if (mode === 'hidden' || !count) expect(rows).toEqual([])
  else {
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(150)
    if (offset) expect(rows.at(-1)).toBe(count - 1)
    else expect(rows[0]).toBe(0)
  }
})
