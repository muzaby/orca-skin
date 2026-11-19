import { describe, expect, it, vi } from 'vitest'
import { Virtualizer } from '@tanstack/virtual-core'
import { createBlockList } from '../../lib/transcript/blockList'

describe('virtualizerOptions (EP-10 · v1, v2, v3)', () => {
  it('v1/v2/v3: keyRevision-pinned getItemKey avoids measurementsCache rebuild on content-only update, rebuilds on reorder, and disables TanStack scroll adjustment', () => {
    const list = createBlockList([
      { key: 'a', text: 'first' },
      { key: 'b', text: 'second' },
      { key: 'c', text: 'third' }
    ])
    let snap = list.snapshot()
    const scrollToFn = vi.fn()
    let getItemKeyCalls = 0
    let currentKeyRev = snap.keyRevision
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
    const cacheBefore = v.measurementsCache
    v.getVirtualItems()
    getItemKeyCalls = 0

    // v1: Content-only replacement (same key sequence → keyRevision unchanged → getItemKey identity unchanged)
    snap = list.splice(1, 1, [{ key: 'b', text: 'second updated' }])
    expect(snap.keyRevision).toBe(currentKeyRev)
    v.setOptions({ ...v.options, count: snap.count, getItemKey })
    v._willUpdate()
    v.getVirtualItems()
    expect(getItemKeyCalls).toBe(0)
    expect(v.measurementsCache).toBe(cacheBefore)

    // v2: Same count, reordered keys → keyRevision increments → new getItemKey → measurementsCache rebuilds
    snap = list.splice(0, 2, [
      { key: 'b', text: 'second updated' },
      { key: 'a', text: 'first' }
    ])
    expect(snap.keyRevision).toBe(currentKeyRev + 1)
    currentKeyRev = snap.keyRevision
    getItemKey = (index: number): string => {
      getItemKeyCalls++
      return snap.keyAt(index)
    }
    v.setOptions({ ...v.options, count: snap.count, getItemKey })
    v._willUpdate()
    v.getVirtualItems()
    expect(getItemKeyCalls).toBeGreaterThan(0)
    expect(v.measurementsCache).not.toBe(cacheBefore)

    // v3: shouldAdjustScrollPositionOnItemSizeChange is () => false → 0 scrollToFn calls on resize above viewport
    scrollToFn.mockClear()
    expect(v.shouldAdjustScrollPositionOnItemSizeChange?.(v.measurementsCache[0], 30, v)).toBe(
      false
    )
    v.resizeItem(0, 80)
    expect(scrollToFn).not.toHaveBeenCalled()
  })
})
