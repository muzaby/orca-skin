import { createElement } from 'react'
import type { Virtualizer } from '@tanstack/virtual-core'
import { type Mock, afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { TranscriptViewport } from '../../../components/transcript/TranscriptViewport'
import { createBlockList, type BlockList, type BlockSnapshot } from '../blockList'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))

let virtualizer: Virtualizer<HTMLDivElement, HTMLElement>
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } =
    await import('../../../components/transcript/viewportTestBridge.testfixture')
  const useVirtualizer = useRealVirtualizerWithFakeHooks<HTMLDivElement, HTMLElement>
  return {
    useVirtualizer(options: Parameters<typeof useVirtualizer>[0]) {
      virtualizer = useVirtualizer(options)
      return virtualizer
    }
  }
})

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
})

interface TestBlock {
  key: string
  text: string
}

function mountViewport(
  scrollTop = 100,
  pinned = false
): {
  list: BlockList<TestBlock>
  render(
    snapshot?: BlockSnapshot<TestBlock>,
    blockModel?: BlockList<TestBlock>
  ): Mock<(index: number) => string>
  scrollTo: Mock
  sizeCache: Map<string, number>
} {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  const scrollTo = vi.fn()
  const scrollRef = {
    current: {
      scrollTop,
      clientHeight: 60,
      clientWidth: 400,
      scrollTo,
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ top: 0, width: 400, height: 60 })
    } as unknown as HTMLDivElement
  }
  const list = createBlockList([
    { key: 'a', text: 'first' },
    { key: 'b', text: 'second' },
    { key: 'c', text: 'third' }
  ])
  const sizeCache = new Map([
    ['a', 30],
    ['b', 70],
    ['c', 40]
  ])

  function render(snapshot = list.snapshot(), blockModel = list): Mock<(index: number) => string> {
    const keyAt = vi.fn(snapshot.keyAt)
    dom!.render(
      createElement(TranscriptViewport<TestBlock>, {
        snapshot: { ...snapshot, keyAt },
        blockModel,
        scrollRef,
        overscan: 0,
        isPinned: () => pinned,
        sizeCache,
        renderBlock: (block) => createElement('div', null, block.text)
      })
    )
    virtualizer.getVirtualItems()
    return keyAt
  }

  render()
  return { list, render, scrollTo, sizeCache }
}

describe('lib/transcript/viewport/virtualizerOptions (VP-21 · EP-10)', () => {
  it('v1: a content-only replacement reuses the production key callback and measurements', () => {
    const { list, render } = mountViewport()
    const measurements = virtualizer.measurementsCache
    for (let index = 0; index < measurements.length; index++) void measurements[index]
    const getItemKey = virtualizer.options.getItemKey
    const revision = list.snapshot().keyRevision

    const next = list.splice(1, 1, [{ key: 'b', text: 'updated' }])
    const keyAt = render(next)

    expect(next.keyRevision).toBe(revision)
    expect(virtualizer.options.getItemKey).toBe(getItemKey)
    keyAt.mockClear()
    virtualizer.getTotalSize()
    expect(keyAt).not.toHaveBeenCalled()
    expect(virtualizer.measurementsCache).toBe(measurements)
  })

  it('v2: a same-count reorder rebuilds measurements with sizes attached to keys', () => {
    const { list, render } = mountViewport()
    const measurements = virtualizer.measurementsCache
    const getItemKey = virtualizer.options.getItemKey
    const next = list.splice(0, 2, [
      { key: 'b', text: 'second' },
      { key: 'a', text: 'first' }
    ])

    expect(render(next)).toHaveBeenCalled()
    expect(virtualizer.options.getItemKey).not.toBe(getItemKey)
    expect(virtualizer.measurementsCache).not.toBe(measurements)
    expect(Array.from(virtualizer.measurementsCache, ({ key, size }) => [key, size])).toEqual([
      ['b', 70],
      ['a', 30],
      ['c', 40]
    ])
  })

  it('v1/v2: estimates read the current key at both ends and fall back outside the snapshot', () => {
    const { list, render } = mountViewport()
    const estimate = virtualizer.options.estimateSize
    expect([-1, 0, 2, 3].map(estimate)).toEqual([120, 30, 40, 120])
    render(
      list.splice(0, 3, [
        { key: 'c', text: 'third' },
        { key: 'd', text: 'uncached' },
        { key: 'a', text: 'first' }
      ])
    )
    expect(virtualizer.options.estimateSize).toBe(estimate)
    expect([0, 1, 2].map(estimate)).toEqual([40, 120, 30])
  })

  it('v2 measures keyed positive heights from the observer or the element rectangle', () => {
    const { sizeCache } = mountViewport(100, true)
    const rect = vi.fn(() => ({ height: 42 }))
    const element = (key: string | null): HTMLElement =>
      ({
        getAttribute: (name: string) => (name === 'data-index' ? '0' : key),
        getBoundingClientRect: rect
      }) as unknown as HTMLElement
    const measure = (key: string | null, height?: number): number =>
      virtualizer.options.measureElement(
        element(key),
        height === undefined
          ? undefined
          : ({ borderBoxSize: [{ blockSize: height }] } as unknown as ResizeObserverEntry),
        virtualizer
      )
    expect(measure('b', 55)).toBe(55)
    expect(rect).not.toHaveBeenCalled()
    expect(sizeCache.get('b')).toBe(55)
    expect(measure('a')).toBe(42)
    expect(rect).toHaveBeenCalledOnce()
    expect(measure('a', 0)).toBe(42)
    expect(measure(null, 70)).toBe(70)
    expect([...sizeCache]).toEqual([
      ['a', 42],
      ['b', 55],
      ['c', 40]
    ])
  })

  it('v2 invalidates cached keys when a different list starts at the same revision', () => {
    const { list, render } = mountViewport()
    const replacement = createBlockList([
      { key: 'c', text: 'third' },
      { key: 'b', text: 'second' },
      { key: 'a', text: 'first' }
    ])
    expect(replacement.snapshot().keyRevision).toBe(list.snapshot().keyRevision)
    render(replacement.snapshot(), replacement)
    expect(Array.from(virtualizer.measurementsCache, ({ key, size }) => [key, size])).toEqual([
      ['c', 40],
      ['b', 70],
      ['a', 30]
    ])
  })

  it.each([
    { index: 0, delta: 50 },
    { index: 0, delta: -10 },
    { index: 2, delta: 50 },
    { index: 2, delta: -10 }
  ])(
    'v3: resizing row $index by $delta leaves scroll adjustment to the viewport',
    ({ index, delta }) => {
      const { scrollTo } = mountViewport(60)
      const item = virtualizer.measurementsCache[index]
      expect(Math.sign(item.start - 60)).toBe(index === 0 ? -1 : 1)
      const total = virtualizer.getTotalSize()
      scrollTo.mockClear()
      expect(
        virtualizer.shouldAdjustScrollPositionOnItemSizeChange?.(item, delta, virtualizer)
      ).toBe(false)
      virtualizer.resizeItem(index, item.size + delta)
      expect(virtualizer.getTotalSize()).toBe(total + delta)
      expect(scrollTo).not.toHaveBeenCalled()
    }
  )
})
