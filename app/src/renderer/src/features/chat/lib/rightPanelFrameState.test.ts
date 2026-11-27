import { expect, it } from 'vitest'
import { framePhase, targetWidth } from './rightPanelFrameState'
it('AC4 targets each saved mode width and preserves room for the transcript', () => {
  expect(targetWidth('code', { work: 360, code: 520 }, 1200)).toBe(520)
  expect(targetWidth('work', { work: 360, code: 520 }, 1200)).toBe(360)
  expect(targetWidth('code', { work: 360, code: 600 }, 1200)).toBe(600)
  expect(targetWidth('work', { work: 600, code: 600 }, 1200)).toBe(600)
  expect(targetWidth('code', { work: 360, code: 600 }, 700)).toBe(460)
})
it('AC5 distinguishes both transitions and settles reduced motion immediately', () => {
  expect(framePhase(true, false, false)).toBe('opening')
  expect(framePhase(false, false, false)).toBe('closing')
  expect(framePhase(true, true, false)).toBe('open')
  expect(framePhase(false, true, false)).toBe('closed')
  expect(framePhase(true, false, true)).toBe('open')
  expect(framePhase(false, false, true)).toBe('closed')
})
