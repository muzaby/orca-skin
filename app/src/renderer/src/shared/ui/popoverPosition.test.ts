import { describe, expect, it } from 'vitest'
import { popoverPosition } from './popoverPosition'
const input = {
  anchor: { left: 20, right: 220, top: 60, bottom: 90, width: 200 },
  boundaryRight: 256,
  width: 184,
  height: 72,
  viewportWidth: 1200,
  viewportHeight: 800,
  align: 'start' as const,
  gap: 0
}
describe('popover placement', () => {
  it('attaches to the nav boundary and button top for expanded and collapsed nav', () => {
    expect(popoverPosition({ ...input, placement: 'right' })).toEqual({ left: 256, top: 60 })
    expect(popoverPosition({ ...input, boundaryRight: 64, placement: 'right' })).toEqual({
      left: 64,
      top: 60
    })
  })
  it('clamps right placement to the viewport', () => {
    expect(
      popoverPosition({ ...input, viewportWidth: 360, viewportHeight: 120, placement: 'right' })
    ).toEqual({ left: 168, top: 40 })
  })
  it('retains top/bottom gap, end/center alignment and vertical flipping', () => {
    expect(popoverPosition({ ...input, gap: 6, placement: 'bottom', align: 'end' })).toEqual({
      right: 980,
      top: 96
    })
    expect(popoverPosition({ ...input, gap: 6, placement: 'top', align: 'center' })).toEqual({
      left: 28,
      top: 96
    })
    expect(popoverPosition({ ...input, gap: 6, viewportHeight: 130, placement: 'bottom' })).toEqual(
      { left: 20, bottom: 76 }
    )
  })
})
