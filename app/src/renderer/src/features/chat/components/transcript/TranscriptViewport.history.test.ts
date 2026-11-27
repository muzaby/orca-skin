import { afterEach, expect, it, vi, type Mock } from 'vitest'
import { writeScrollTop } from './TranscriptViewport'
import {
  cancelEntryMotion,
  entryMoving,
  followEntryMotion,
  pauseEntryMotion,
  resumeEntryMotion,
  startEntryMotion
} from '../../lib/transcript/viewport/entryMotion'

afterEach(() => vi.unstubAllGlobals())

interface MotionFixture {
  el: HTMLElement
  scroll: { scrollTop: number; scrollHeight: number; scrollTo: Mock }
  body: { animate: Mock }
  write: (top: number, behavior: ScrollBehavior) => void
}
function motionFixture(reduced = false): MotionFixture {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) })
  const body = { querySelector: () => ({}), animate: vi.fn() }
  const scroll = {
    scrollTop: 10,
    scrollHeight: 900,
    clientHeight: 400,
    dataset: {},
    querySelector: () => body,
    scrollTo: vi.fn()
  }
  const el = scroll as unknown as HTMLElement
  const write = (top: number, behavior: ScrollBehavior): void =>
    writeScrollTop(el, top, behavior, 'claude')
  return { el, scroll, body, write }
}

it('AC15 anchor and virtualizer always write instantly even with a smooth request', () => {
  const { el, scroll } = motionFixture()
  for (const owner of ['anchor', 'virtualizer', 'claude', 'opencode'] as const)
    writeScrollTop(el, 42, 'smooth', owner)
  expect(scroll.scrollTo.mock.calls.map(([value]) => value.behavior)).toEqual([
    'instant',
    'instant',
    'smooth',
    'smooth'
  ])
})

it.each([true, false])(
  'pauses before prepend and resumes only while the entry still owns the view (cancel=%s)',
  (cancel) => {
    const { el, scroll, write } = motionFixture()
    startEntryMotion(el, write, true)
    expect(scroll.scrollTo).toHaveBeenLastCalledWith({ top: 500, behavior: 'smooth' })
    scroll.scrollTop = 112
    pauseEntryMotion(el)
    expect(scroll.scrollTo).toHaveBeenLastCalledWith({ top: 112, behavior: 'instant' })
    scroll.scrollHeight = 1800
    expect(followEntryMotion(el)).toBe(true)
    expect(scroll.scrollTo).toHaveBeenCalledTimes(2)
    if (cancel) cancelEntryMotion(el)
    resumeEntryMotion(el)
    expect(scroll.scrollTo).toHaveBeenCalledTimes(cancel ? 2 : 3)
    if (!cancel) expect(scroll.scrollTo).toHaveBeenLastCalledWith({ top: 1400, behavior: 'smooth' })
    expect(entryMoving(el)).toBe(!cancel)
  }
)

it.each([true, false])(
  'places the first visible content at the bottom and respects reduced motion=%s',
  (reduced) => {
    const { el, scroll, body, write } = motionFixture(reduced)
    startEntryMotion(el, write, false)
    expect(scroll.scrollTo).toHaveBeenLastCalledWith({ top: 500, behavior: 'instant' })
    expect(body.animate).toHaveBeenCalledTimes(reduced ? 0 : 1)
    scroll.scrollHeight = 1400
    followEntryMotion(el)
    expect(scroll.scrollTo).toHaveBeenLastCalledWith({
      top: 1000,
      behavior: reduced ? 'instant' : 'smooth'
    })
  }
)
