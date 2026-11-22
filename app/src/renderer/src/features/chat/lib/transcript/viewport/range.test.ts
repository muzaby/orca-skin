import { describe, expect, it } from 'vitest'
import { viewportMountSet } from './range'

describe('viewportMountSet window and anchor boundaries', () => {
  it.each([
    { count: 0, start: 0, end: 0, overscan: 1, expected: [] },
    { count: 1, start: 0, end: 0, overscan: 0, expected: [0] },
    { count: 5, start: 0, end: 1, overscan: 1, expected: [0, 1, 2] },
    { count: 5, start: 3, end: 4, overscan: 1, expected: [2, 3, 4] },
    { count: 5, start: 3, end: 2, overscan: 1, expected: [] }
  ])('clamps [$start,$end] with count $count and overscan $overscan', (row) => {
    const { start: startIndex, end: endIndex, overscan, count, expected } = row
    expect(viewportMountSet({ startIndex, endIndex, overscan, count })).toEqual(expected)
  })

  it.each([
    { view: 10, expected: [10] },
    { view: 4, expected: [4] },
    { view: -1, expected: [] },
    { view: 11, expected: [] }
  ])('mounts the viewport anchor $view outside the window', ({ view, expected }) => {
    expect(viewportMountSet({ startIndex: 1, endIndex: 0, overscan: 1, count: 11 }, view)).toEqual(
      expected
    )
  })
})
