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

function mountViewport(): {
  list: BlockList<TestBlock>
  render(
    snapshot?: BlockSnapshot<TestBlock>,
    blockModel?: BlockList<TestBlock>
  ): Mock<(index: number) => string>
  scrollTo: Mock
} {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  const scrollTo = vi.fn()
  const scrollRef = {
    current: {
      scrollTop: 100,
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
        sizeCache,
        renderBlock: (block) => createElement('div', null, block.text)
      })
    )
    virtualizer.getVirtualItems()
    return keyAt
  }

  render()
  return { list, render, scrollTo }
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

  it('v3: the viewport disables TanStack scroll adjustment for growth above the view', () => {
    const { scrollTo } = mountViewport()
    scrollTo.mockClear()

    expect(
      virtualizer.shouldAdjustScrollPositionOnItemSizeChange?.(
        virtualizer.measurementsCache[0],
        50,
        virtualizer
      )
    ).toBe(false)
    virtualizer.resizeItem(0, 80)

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
