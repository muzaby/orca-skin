// A reader's captured glyph owns scrollTop until two consecutive frames pass without layout work.
export type ScrollOwner = 'anchor' | 'claude' | 'opencode' | 'virtualizer' | 'viewport'
export interface ScrollTrace {
  time: number
  event: 'open' | 'settled' | 'cancel' | 'write' | 'blocked' | 'first-measure' | 'resize-above'
  owner?: ScrollOwner
  correcting: boolean
  top: number
}
interface Correction {
  corrected: boolean
  quietFrames: number
  frame: number
  settled: () => void
}
const corrections = new WeakMap<HTMLElement, Correction>()
const observers = new WeakMap<HTMLElement, (record: ScrollTrace) => void>()

export function observeScrollWrites(
  element: HTMLElement,
  fn: (record: ScrollTrace) => void
): () => void {
  if (import.meta.env.VITE_OO_DIAGNOSTIC === '1') observers.set(element, fn)
  return () => observers.delete(element)
}
function trace(element: HTMLElement, event: ScrollTrace['event'], owner?: ScrollOwner): void {
  if (import.meta.env.VITE_OO_DIAGNOSTIC === '1')
    observers.get(element)?.({
      time: performance.now(),
      event,
      owner,
      correcting: corrections.has(element),
      top: element.scrollTop
    })
}
export function traceAnchorMeasurement(element: HTMLElement | null, first: boolean): void {
  if (import.meta.env.VITE_OO_DIAGNOSTIC === '1' && element)
    trace(element, first ? 'first-measure' : 'resize-above')
}

export function noteCorrectionLayout(element: HTMLElement | null): boolean {
  const correction = element && corrections.get(element)
  if (!correction) return false
  correction.quietFrames = 0
  return true
}
export function beginCorrection(element: HTMLElement, settled: () => void): void {
  if (noteCorrectionLayout(element) || typeof requestAnimationFrame !== 'function') return
  const correction: Correction = { corrected: false, quietFrames: 0, frame: 0, settled }
  corrections.set(element, correction)
  trace(element, 'open')
  const tick = (): void => {
    if (++correction.quietFrames < 2) {
      correction.frame = requestAnimationFrame(tick)
      return
    }
    trace(element, 'settled')
    corrections.delete(element)
    correction.settled()
  }
  correction.frame = requestAnimationFrame(tick)
}
export function cancelCorrection(element: HTMLElement | null): void {
  if (!element) return
  const correction = corrections.get(element)
  if (!correction) return
  cancelAnimationFrame(correction.frame)
  trace(element, 'cancel')
  corrections.delete(element)
}

export function hasWrittenCorrection(element: HTMLElement | null): boolean {
  return !!element && corrections.get(element)?.corrected === true
}

export function applyScrollWrite(
  element: HTMLElement,
  owner: ScrollOwner,
  write: () => void
): void {
  const correction = corrections.get(element)
  if (
    (correction && owner !== 'anchor') ||
    (element.dataset?.historyReading !== undefined && (owner === 'claude' || owner === 'opencode'))
  ) {
    trace(element, 'blocked', owner)
    return
  }
  write()
  if (correction && owner === 'anchor') {
    correction.corrected = true
    correction.quietFrames = 0
  }
  trace(element, 'write', owner)
}
