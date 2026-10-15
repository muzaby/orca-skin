import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ScrollAnchor } from '../../common/transcript/scrollTypes'
import {
  canConsumeScroll,
  isTimelineBottom,
  nextTimelinePin,
  shouldShowTimelineJump
} from './scrollPolicy'
import { timelineViewState } from './viewState'
import { TimelineScrollContext, type TimelineScroll } from './scrollContext'
const geometry = (el: HTMLDivElement): { top: number; height: number; viewport: number } => ({
  top: el.scrollTop,
  height: el.scrollHeight,
  viewport: el.clientHeight
})
function rowFor(node: Node | null): HTMLElement | null {
  return (
    (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>(
      '[data-timeline-key]'
    ) ?? null
  )
}

export function OpenCodeScrollController({
  sessionKey,
  children
}: {
  sessionKey: string
  children: (scroll: ScrollAnchor) => ReactNode
}): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const state = useMemo(() => timelineViewState(sessionKey), [sessionKey])
  const held = useRef(false)
  const gestureUntil = useRef(0)
  const lastTop = useRef(state.top)
  const automaticTop = useRef<number | null>(null)
  const [showJump, setShowJump] = useState(false)
  const [retained, setRetained] = useState<string[]>([])
  const capture = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    state.setTop(el.scrollTop)
    const top = el.getBoundingClientRect().top
    const row = Array.from(el.querySelectorAll<HTMLElement>('[data-timeline-key]')).find(
      (item) => item.getBoundingClientRect().bottom > top
    )
    if (row)
      state.setAnchor({
        key: row.dataset.timelineKey!,
        offset: row.getBoundingClientRect().top - top
      })
  }, [state])
  const writeTop = useCallback(
    (top: number) => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = top
      automaticTop.current = el.scrollTop
      lastTop.current = el.scrollTop
      state.setTop(el.scrollTop)
      setShowJump(shouldShowTimelineJump(geometry(el)))
    },
    [state]
  )
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    state.setPinned(true)
    state.setAnchor(null)
    writeTop(el.scrollHeight)
  }, [state, writeTop])
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const automatic =
      automaticTop.current !== null && Math.abs(el.scrollTop - automaticTop.current) <= 0.5
    automaticTop.current = null
    if (!automatic && (held.current || Date.now() <= gestureUntil.current)) {
      state.setPinned(
        nextTimelinePin(
          state.pinned,
          el.scrollTop < lastTop.current ? 'up' : 'scroll',
          geometry(el)
        )
      )
    }
    lastTop.current = el.scrollTop
    setShowJump(shouldShowTimelineJump(geometry(el)))
    capture()
  }, [capture, state])

  useLayoutEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return
    let frame: number | null = null
    writeTop(state.pinned ? el.scrollHeight : state.top)
    const nested = (target: EventTarget | null, direction = 0): boolean => {
      if (!(target instanceof Element)) return false
      // Markdown code fences are shared with Claude and need no harness-specific
      // DOM changes. Respect their own vertical scroll region as well.
      for (let node: Element | null = target; node && node !== el; node = node.parentElement) {
        if (
          canConsumeScroll(
            { top: node.scrollTop, height: node.scrollHeight, viewport: node.clientHeight },
            direction
          ) &&
          /auto|scroll/.test(getComputedStyle(node).overflowY)
        )
          return true
      }
      return false
    }
    const unpin = (): void => {
      state.setPinned(false)
      capture()
    }
    const wheel = (event: WheelEvent): void => {
      if (nested(event.target, event.deltaY)) return
      gestureUntil.current = Date.now() + 250
      if (event.deltaY < 0) unpin()
    }
    const key = (event: KeyboardEvent): void => {
      const upward =
        ['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)
      if (nested(event.target, upward ? -1 : 1)) return
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
        gestureUntil.current = Date.now() + 250
        if (
          ['ArrowUp', 'PageUp', 'Home'].includes(event.key) ||
          (event.key === ' ' && event.shiftKey)
        )
          unpin()
      }
    }
    const down = (event: PointerEvent): void => {
      if (nested(event.target)) return
      capture()
      held.current = true
      const row = rowFor(event.target instanceof Node ? event.target : null)
      if (row?.dataset.timelineKey) setRetained([row.dataset.timelineKey])
    }
    const selection = (): void => {
      const value = document.getSelection()
      const start = rowFor(value?.anchorNode ?? null)
      const end = rowFor(value?.focusNode ?? null)
      if (!value?.isCollapsed && start && end && el.contains(start) && el.contains(end)) {
        unpin()
        setRetained([start.dataset.timelineKey!, end.dataset.timelineKey!])
      } else if (!held.current) setRetained([])
    }
    const up = (): void => {
      if (!held.current) return
      held.current = false
      selection()
    }
    const resize = (): void => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        if (held.current) return
        if (state.pinned) writeTop(el.scrollHeight)
        else if (state.anchor) {
          const anchor = Array.from(el.querySelectorAll<HTMLElement>('[data-timeline-key]')).find(
            (row) => row.dataset.timelineKey === state.anchor!.key
          )
          if (anchor) {
            const delta =
              anchor.getBoundingClientRect().top -
              el.getBoundingClientRect().top -
              state.anchor.offset
            writeTop(el.scrollTop + delta)
          }
        }
        setShowJump(shouldShowTimelineJump(geometry(el)))
      })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    observer.observe(content)
    el.addEventListener('wheel', wheel, { passive: true })
    el.addEventListener('keydown', key)
    el.addEventListener('pointerdown', down)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
    document.addEventListener('selectionchange', selection)
    return () => {
      state.setTop(el.scrollTop)
      if (isTimelineBottom(geometry(el)) && state.pinned) state.setAnchor(null)
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('keydown', key)
      el.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      document.removeEventListener('selectionchange', selection)
    }
  }, [capture, state, writeTop])
  const scroll: TimelineScroll = {
    scrollRef,
    contentRef,
    onScroll,
    showJump,
    scrollToBottom,
    anchored: false,
    state,
    retained
  }
  return (
    <TimelineScrollContext.Provider value={scroll}>
      {children(scroll)}
    </TimelineScrollContext.Provider>
  )
}
