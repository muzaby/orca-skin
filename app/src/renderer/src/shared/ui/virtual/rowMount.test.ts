import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { installFakeDom } from '../renderHarness.testfixture'
import { useMountedRows, VirtualRowMountContext } from './rowMount'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../renderHarness.testfixture')).fakeHooks
}))
function Probe({ keys }: { keys: (number | string)[] }): null {
  useMountedRows(keys)
  return null
}
it.each([
  ['rm1 first mount', [], [0, 1], 1],
  ['rm2 overlap replacement', [0, 1], [1, 2], 1],
  ['rm3 removal only', [0, 1, 2], [0, 1], 0],
  ['rm4 same keys', [0, 1], [0, 1], 0],
  ['rm5 disjoint replacement', [0, 1], [2, 3], 1],
  ['rm7 reorder', [0, 1], [1, 0], 0],
  ['rm9 same count with a new identity', ['a', 'b'], ['a', 'c'], 1],
  ['rm10 stable identities after reorder', ['a', 'b'], ['b', 'a'], 0]
] as const)('%s', (_, before, after, calls) => {
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 }),
    notify = vi.fn()
  const render = (keys: readonly (number | string)[]): void =>
    dom.render(
      createElement(
        VirtualRowMountContext.Provider,
        { value: notify },
        createElement(Probe, { keys: [...keys] })
      )
    )
  try {
    render(before)
    notify.mockClear()
    render(after)
    expect(notify).toHaveBeenCalledTimes(calls)
  } finally {
    dom.unmount()
    vi.unstubAllGlobals()
  }
})
it('rm6 absent owner', () => {
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  try {
    expect(() => dom.render(createElement(Probe, { keys: [1] }))).not.toThrow()
  } finally {
    dom.unmount()
    vi.unstubAllGlobals()
  }
})
it('rm8 comparison baseline advances on every commit', () => {
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 }),
    notify = vi.fn()
  try {
    for (const keys of [
      [0, 1],
      [0, 1, 2],
      [0, 1, 2],
      [1, 2],
      [1, 2, 3]
    ]) {
      dom.render(
        createElement(
          VirtualRowMountContext.Provider,
          { value: notify },
          createElement(Probe, { keys })
        )
      )
      if (keys.join(',') === '0,1') notify.mockClear()
    }
    expect(notify).toHaveBeenCalledTimes(2)
  } finally {
    dom.unmount()
    vi.unstubAllGlobals()
  }
})
