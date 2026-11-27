// Only the currently displayed session can own a bottom transition. Its initial
// paint uses the bottom immediately. Later size changes start from the visible
// position and may be interrupted by a prepend or by the reader.
type Motion = {
  write: (top: number, behavior: ScrollBehavior) => void
  target: number
  shown: boolean
  paused: boolean
  moving: boolean
}
const motions = new WeakMap<HTMLElement, Motion>()
const reduced = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export function startEntryMotion(
  el: HTMLElement,
  write: Motion['write'],
  alreadyVisible: boolean
): void {
  motions.set(el, { write, target: -1, shown: alreadyVisible, paused: false, moving: false })
  followEntryMotion(el)
}

export function followEntryMotion(el: HTMLElement): boolean {
  const motion = motions.get(el)
  if (!motion) return false
  if (motion.paused || el.dataset?.historyReading !== undefined) return true
  const body = el.querySelector?.<HTMLElement>('[data-transcript-viewport]')
  if (!body?.querySelector('[data-block-key]')) return false
  const target = Math.max(0, el.scrollHeight - el.clientHeight)
  if (motion.target === target) return true
  motion.target = target
  const first = !motion.shown
  motion.shown = true
  motion.moving = !first && !reduced() && Math.abs(target - el.scrollTop) > 1
  motion.write(target, motion.moving ? 'smooth' : 'instant')
  if (first && !reduced())
    body.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
  return true
}

export function entryMoving(el: HTMLElement | null): boolean {
  const motion = el && motions.get(el)
  if (!el || !motion) return false
  if (Math.abs(el.scrollTop - motion.target) <= 1) motion.moving = false
  return motion.paused || motion.moving
}

export function pauseEntryMotion(el: HTMLElement): void {
  const motion = motions.get(el)
  if (!motion || motion.paused) return
  motion.write(el.scrollTop, 'instant')
  motion.paused = true
}

export function resumeEntryMotion(el: HTMLElement): void {
  const motion = motions.get(el)
  if (!motion?.paused) return
  motion.paused = false
  motion.target = -1
  followEntryMotion(el)
}

export function cancelEntryMotion(el: HTMLElement | null): void {
  if (!el) return
  const motion = motions.get(el)
  if (!motion) return
  if (entryMoving(el) && !motion.paused) motion.write(el.scrollTop, 'instant')
  motions.delete(el)
}
