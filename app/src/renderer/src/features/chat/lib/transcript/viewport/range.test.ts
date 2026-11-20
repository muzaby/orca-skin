import { describe, expect, it } from 'vitest'
import { selectionMountSet } from './range'

describe('selectionMountSet window and endpoint boundaries', () => {
  it.each([
    { count: 0, start: 0, end: 0, overscan: 1, expected: [] },
    { count: 1, start: 0, end: 0, overscan: 0, expected: [0] },
    { count: 5, start: 0, end: 1, overscan: 1, expected: [0, 1, 2] },
    { count: 5, start: 3, end: 4, overscan: 1, expected: [2, 3, 4] },
    { count: 5, start: 3, end: 2, overscan: 1, expected: [] }
  ])('clamps [$start,$end] with count $count and overscan $overscan', (row) => {
    const { start: startIndex, end: endIndex, overscan, count, expected } = row
    expect(selectionMountSet({ startIndex, endIndex, overscan, count }, null)).toEqual(expected)
  })

  it.each([
    { anchor: 0, focus: 4, view: 10, expected: [0, 3, 4, 5, 10] },
    { anchor: 10, focus: 0, view: 4, expected: [0, 1, 4, 10] },
    { anchor: 4, focus: 10, view: 0, expected: [0, 4, 9, 10] },
    { anchor: -1, focus: -1, view: -1, expected: [] },
    { anchor: 11, focus: 11, view: 11, expected: [] },
    { anchor: 3, focus: 4, view: 5, expected: [3, 4, 5] }
  ])('mounts anchor $anchor, focus $focus and viewport anchor $view independently', (row) => {
    const { anchor: anchorIndex, focus: focusIndex, view, expected } = row
    expect(
      selectionMountSet(
        { startIndex: 1, endIndex: 0, overscan: 1, count: 11 },
        { anchorIndex, focusIndex },
        view
      )
    ).toEqual(expected)
  })
})
