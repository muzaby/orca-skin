import { createContext, useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import { planUpwardExpansionCompensation } from '../lib/diffViewport'

export const DiffScrollAnchorContext = createContext<((row: HTMLElement) => void) | null>(null)
interface Anchor {
  file: string
  id: string
  top: number
  scroll: number
}
export function useDiffScrollCoordinator(
  owner: RefObject<HTMLDivElement | null>,
  tail: RefObject<HTMLDivElement | null>
): (row: HTMLElement) => void {
  const saved = useRef<Anchor | null>(null)
  const remember = useCallback((row: HTMLElement): void => {
    const file = row.closest('[data-diff-file]')?.getAttribute('data-diff-file')
    const id = row.getAttribute('data-window-row') ?? row.getAttribute('data-diff-hunk-row-id')
    const scroll = row.closest<HTMLElement>('[data-diff-scroll-owner]')
    if (file && id && scroll)
      saved.current = {
        file,
        id,
        top: row.getBoundingClientRect().top,
        scroll: scroll.scrollTop
      }
  }, [])
  useLayoutEffect(() => {
    const el = owner.current,
      spacer = tail.current
    if (
      !el ||
      !spacer ||
      typeof ResizeObserver === 'undefined' ||
      typeof MutationObserver === 'undefined'
    )
      return
    let frame = 0
    const capture = (): void => {
      saved.current = null
      const rect = el.getBoundingClientRect()
      const rows = el.querySelectorAll<HTMLElement>('[data-window-row],[data-diff-hunk-row-id]')
      for (const row of rows) {
        const box = row.getBoundingClientRect()
        if (box.bottom > rect.top + 32 && box.top < rect.bottom) {
          remember(row)
          break
        }
      }
    }
    const correct = (): void => {
      frame = 0
      const a = saved.current
      if (a && el.scrollTop === a.scroll) {
        const file = el.querySelector('[data-diff-file="' + CSS.escape(a.file) + '"]')
        const id = CSS.escape(a.id)
        const row = file?.querySelector(
          '[data-window-row="' + id + '"],[data-diff-hunk-row-id="' + id + '"]'
        )
        const delta = row ? row.getBoundingClientRect().top - a.top : 0
        if (Math.abs(delta) >= 1) {
          const next = planUpwardExpansionCompensation({
            scrollTop: el.scrollTop,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            anchorDelta: delta,
            tailSpacerHeight: parseFloat(spacer.style.height) || 0
          })
          if (next.tailSpacerHeight !== (parseFloat(spacer.style.height) || 0))
            spacer.style.height = next.tailSpacerHeight + 'px'
          el.scrollTop = delta < 0 ? Math.max(0, el.scrollTop + delta) : next.scrollTop
        }
      }
      capture()
    }
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(correct)
    }
    const sizes = new ResizeObserver(schedule)
    const observed = new Set<Element>()
    const observe = (): void => {
      const current = new Set(el.querySelectorAll('[data-diff-file],[data-window-row]'))
      for (const item of observed)
        if (!current.has(item)) {
          sizes.unobserve(item)
          observed.delete(item)
        }
      for (const item of current)
        if (!observed.has(item)) {
          sizes.observe(item)
          observed.add(item)
        }
      schedule()
    }
    const changes = new MutationObserver(observe)
    changes.observe(el, { subtree: true, childList: true })
    el.addEventListener('scroll', capture, { passive: true })
    observe()
    return () => {
      changes.disconnect()
      sizes.disconnect()
      el.removeEventListener('scroll', capture)
      cancelAnimationFrame(frame)
    }
  }, [owner, tail, remember])
  return remember
}
