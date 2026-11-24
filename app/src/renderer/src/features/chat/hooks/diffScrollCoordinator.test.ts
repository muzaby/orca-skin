import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useDiffScrollCoordinator } from './useDiffScrollCoordinator'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
let dom: FakeDom
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
})
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function fixture() {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  let resize!: () => void, mutate!: () => void, frame!: () => void
  const raf = vi.fn((f: () => void) => {
    frame = f
    return 1
  })
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('CSS', { escape: (s: string) => s })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resize = cb
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(cb: () => void) {
        mutate = cb
      }
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  let scroll = 100,
    layout = 150
  const write = vi.fn((v: number) => {
    scroll = v
  })
  const file = { getAttribute: () => 'sample', querySelector: () => row }
  const row = {
    getAttribute: () => 'line:3',
    getBoundingClientRect: () => ({ top: layout - scroll, bottom: layout - scroll + 20 }),
    closest: (s: string) => (s === '[data-diff-file]' ? file : owner)
  }
  const owner = {
    get scrollTop() {
      return scroll
    },
    set scrollTop(v: number) {
      write(v)
    },
    clientHeight: 500,
    scrollHeight: 5000,
    querySelectorAll: () => [row],
    querySelector: () => file,
    getBoundingClientRect: () => ({ top: 0, bottom: 500 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
  const root = { current: owner as unknown as HTMLDivElement },
    tail = { current: { style: { height: '0px' } } as HTMLDivElement }
  function Probe(): null {
    useDiffScrollCoordinator(root, tail)
    return null
  }
  dom.render(createElement(Probe))
  frame()
  raf.mockClear()
  return {
    resize,
    mutate,
    frame: () => frame(),
    shift: (px: number) => {
      layout += px
    },
    write,
    raf,
    row
  }
}
it('sc1 combines expansion, row remeasurement and file resize in one frame', () => {
  const v = fixture()
  v.shift(40)
  v.mutate()
  v.shift(20)
  v.resize()
  v.shift(5)
  v.resize()
  expect(v.raf).toHaveBeenCalledTimes(1)
  expect(v.write).not.toHaveBeenCalled()
  v.frame()
  expect(v.write.mock.calls).toEqual([[165]])
})
it('sc2 restoring the placeholder height keeps the visible row within one pixel', () => {
  const v = fixture(),
    before = v.row.getBoundingClientRect().top
  v.shift(-32)
  v.resize()
  v.frame()
  expect(Math.abs(v.row.getBoundingClientRect().top - before)).toBeLessThanOrEqual(1)
})

it('schedules a correction from a resize with no accompanying DOM mutation', () => {
  const v = fixture()
  v.shift(17)
  v.resize()
  expect(v.raf).toHaveBeenCalledOnce()
  v.frame()
  expect(v.write).toHaveBeenCalledTimes(1)
})
