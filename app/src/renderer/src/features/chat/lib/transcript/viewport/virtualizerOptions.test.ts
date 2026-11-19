import { describe, expect, it, vi } from 'vitest'
import { Virtualizer } from '@tanstack/virtual-core'
import { createBlockList } from '../blockList'

function makeVirtualizer(
  initial: Array<{ key: string; text: string }>,
  scrollToFn = vi.fn()
): {
  list: ReturnType<typeof createBlockList<{ key: string; text: string }>>
  v: Virtualizer<Element, Element>
  scrollToFn: ReturnType<typeof vi.fn>
  getSnap: () => ReturnType<
    ReturnType<typeof createBlockList<{ key: string; text: string }>>['snapshot']
  >
  setSnap: (
    next: ReturnType<ReturnType<typeof createBlockList<{ key: string; text: string }>>['snapshot']>
  ) => void
  getCalls: () => number
  resetCalls: () => void
  getKeyFn: () => (index: number) => string
  rebindKeyFn: () => (index: number) => string
} {
  const list = createBlockList(initial)
  let snap = list.snapshot()
  let getItemKeyCalls = 0
  let getItemKey = (index: number): string => {
    getItemKeyCalls++
    return snap.keyAt(index)
  }
  const v = new Virtualizer<Element, Element>({
    count: snap.count,
    getScrollElement: () => ({}) as unknown as Element,
    estimateSize: () => 50,
    getItemKey,
    scrollToFn,
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: 300 })
    },
    observeElementOffset: (_inst, cb) => {
      cb(0, false)
    }
  })
  v.shouldAdjustScrollPositionOnItemSizeChange = () => false
  v._didMount()
  v._willUpdate()
  v.getVirtualItems()

  return {
    list,
    v,
    scrollToFn,
    getSnap: () => snap,
    setSnap: (next: typeof snap) => {
      snap = next
    },
    getCalls: () => getItemKeyCalls,
    resetCalls: () => {
      getItemKeyCalls = 0
    },
    getKeyFn: () => getItemKey,
    rebindKeyFn: () => {
      getItemKey = (index: number): string => {
        getItemKeyCalls++
        return snap.keyAt(index)
      }
      return getItemKey
    }
  }
}

describe('lib/transcript/viewport/virtualizerOptions (VP-21 · EP-10 · v1~v3)', () => {
  it('v1: content-only replacement keeps keyRevision and getItemKey identity, causing 0 getItemKey calls and keeping measurementsCache', () => {
    const h = makeVirtualizer([
      { key: 'a', text: 'first' },
      { key: 'b', text: 'second' },
      { key: 'c', text: 'third' }
    ])
    const revBefore = h.getSnap().keyRevision
    const cacheBefore = h.v.measurementsCache
    h.resetCalls()

    const next = h.list.splice(1, 1, [{ key: 'b', text: 'second updated' }])
    h.setSnap(next)
    expect(next.keyRevision).toBe(revBefore)

    h.v.setOptions({ ...h.v.options, count: next.count, getItemKey: h.getKeyFn() })
    h.v._willUpdate()
    h.v.getVirtualItems()
    expect(h.getCalls()).toBe(0)
    expect(h.v.measurementsCache).toBe(cacheBefore)
  })

  it('v2: same-count key reorder increments keyRevision, rebinds getItemKey, and rebuilds measurementsCache', () => {
    const h = makeVirtualizer([
      { key: 'a', text: 'first' },
      { key: 'b', text: 'second' },
      { key: 'c', text: 'third' }
    ])
    const revBefore = h.getSnap().keyRevision
    const cacheBefore = h.v.measurementsCache
    h.resetCalls()

    const next = h.list.splice(0, 2, [
      { key: 'b', text: 'second' },
      { key: 'a', text: 'first' }
    ])
    h.setSnap(next)
    expect(next.keyRevision).toBe(revBefore + 1)

    const nextKeyFn = h.rebindKeyFn()
    h.v.setOptions({ ...h.v.options, count: next.count, getItemKey: nextKeyFn })
    h.v._willUpdate()
    h.v.getVirtualItems()
    expect(h.getCalls()).toBeGreaterThan(0)
    expect(h.v.measurementsCache).not.toBe(cacheBefore)
  })

  it('v3: shouldAdjustScrollPositionOnItemSizeChange is disabled so resizing above viewport makes 0 scrollToFn calls', () => {
    const scrollToFn = vi.fn()
    const h = makeVirtualizer(
      [
        { key: 'a', text: 'first' },
        { key: 'b', text: 'second' }
      ],
      scrollToFn
    )
    scrollToFn.mockClear()
    expect(
      h.v.shouldAdjustScrollPositionOnItemSizeChange?.(h.v.measurementsCache[0], 30, h.v)
    ).toBe(false)
    h.v.resizeItem(0, 80)
    expect(scrollToFn).not.toHaveBeenCalled()
  })
})
