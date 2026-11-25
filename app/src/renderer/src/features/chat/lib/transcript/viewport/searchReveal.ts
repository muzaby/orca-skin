export interface SearchReveal {
  seq: number
  target: string
  keyboard: boolean
  restore: boolean
}

export function revealSearchRow(
  scroller: HTMLElement,
  selection: SearchReveal,
  locate: () => HTMLElement | undefined,
  scroll: (top: number) => void,
  announce: () => void,
  finished?: () => void
): () => void {
  let frame = 0
  let timer = 0
  let highlighted: HTMLElement | undefined
  let previousTabIndex: string | null = null
  const initialFocus = document.activeElement
  const controller = new AbortController()
  const stop = (): void => {
    if (controller.signal.aborted) return
    controller.abort()
    cancelAnimationFrame(frame)
    window.clearTimeout(timer)
    highlighted?.removeAttribute('data-history-highlight')
    if (highlighted && selection.keyboard) {
      if (previousTabIndex === null) highlighted.removeAttribute('tabindex')
      else highlighted.setAttribute('tabindex', previousTabIndex)
    }
  }
  const release = (): void => {
    stop()
    finished?.()
  }
  const options = { signal: controller.signal, capture: true, passive: true }
  scroller.addEventListener('wheel', release, options)
  document.addEventListener('pointerdown', release, options)
  document.addEventListener('keydown', release, options)
  document.addEventListener(
    'focusin',
    (e) => {
      if (e.target !== highlighted && e.target !== initialFocus) release()
    },
    options
  )
  let positioned = false
  const measure = (): void => {
    if (controller.signal.aborted) return
    const row = locate()
    if (row && !row.closest('[inert],[hidden]')) {
      const box = row.getBoundingClientRect()
      const viewport = scroller.getBoundingClientRect()
      if (viewport.height > 0 && box.height > 0) {
        if (
          box.bottom <= viewport.top ||
          box.top >= viewport.bottom ||
          (!positioned && (box.top < viewport.top || box.bottom > viewport.bottom))
        ) {
          scroll(
            scroller.scrollTop +
              box.top -
              viewport.top -
              Math.max(0, (viewport.height - Math.min(box.height, viewport.height)) / 2)
          )
          positioned = true
        } else if (box.bottom > viewport.top && box.top < viewport.bottom) {
          if (selection.restore) {
            release()
            return
          }
          highlighted = row
          previousTabIndex = row.getAttribute('tabindex')
          row.setAttribute('data-history-highlight', '')
          if (
            selection.keyboard &&
            (document.activeElement === initialFocus || document.activeElement === document.body)
          ) {
            row.tabIndex = -1
            row.focus({ preventScroll: true })
          }
          announce()
          timer = window.setTimeout(release, 2000)
          return
        }
      }
    }
    frame = requestAnimationFrame(measure)
  }
  frame = requestAnimationFrame(measure)
  return stop
}
