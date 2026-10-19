import { describe, expect, it } from 'vitest'
import {
  canConsumeScroll,
  isTimelineBottom,
  nextTimelinePin,
  shouldShowTimelineJump
} from './scrollPolicy'
const bottom = { top: 1500, height: 2000, viewport: 500 }
describe('OpenCode scroll policy', () => {
  it('lets short output and nested scroll boundaries reach the outer controller', () => {
    expect(canConsumeScroll({ top: 0, height: 60, viewport: 60 }, -1)).toBe(false)
    expect(canConsumeScroll({ top: 0, height: 600, viewport: 240 }, -1)).toBe(false)
    expect(canConsumeScroll({ top: 0, height: 600, viewport: 240 }, 1)).toBe(true)
    expect(canConsumeScroll({ top: 360, height: 600, viewport: 240 }, 1)).toBe(false)
    expect(canConsumeScroll({ top: 360, height: 600, viewport: 240 }, -1)).toBe(true)
  })
  it('uses half-pixel bottom tolerance', () => {
    expect(isTimelineBottom({ ...bottom, top: 1499.5 })).toBe(true)
    expect(isTimelineBottom({ ...bottom, top: 1499.49 })).toBe(false)
  })
  it('unpins upward gestures and selections, never repins from resize, and resumes at bottom/jump', () => {
    expect(nextTimelinePin(true, 'up', bottom)).toBe(false)
    expect(nextTimelinePin(true, 'selection', bottom)).toBe(false)
    expect(nextTimelinePin(false, 'resize', bottom)).toBe(false)
    expect(nextTimelinePin(false, 'scroll', bottom)).toBe(true)
    expect(nextTimelinePin(false, 'jump', { ...bottom, top: 0 })).toBe(true)
  })
  it('shows jump only beyond the larger of 400px or the viewport', () => {
    expect(shouldShowTimelineJump({ ...bottom, top: 1000 })).toBe(false)
    expect(shouldShowTimelineJump({ ...bottom, top: 999 })).toBe(true)
    expect(shouldShowTimelineJump({ top: 300, height: 1000, viewport: 300 })).toBe(false)
    expect(shouldShowTimelineJump({ top: 299, height: 1000, viewport: 300 })).toBe(true)
  })
})
