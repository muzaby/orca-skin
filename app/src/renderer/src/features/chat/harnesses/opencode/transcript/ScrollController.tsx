import { nestedScrollConsumes } from '../../../lib/transcript/viewport/scrollGeometry'
import { writeScrollTop } from '../../../components/transcript/TranscriptViewport'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ScrollAnchor } from '../../common/transcript/scrollTypes'
import {
  cancelEntryMotion,
  followEntryMotion,
  startEntryMotion
} from '../../../lib/transcript/viewport/entryMotion'
import { entryPolicy } from '../../../lib/transcript/viewport/entry'
import { consumeEntryIntent } from '../../../store/chatStore'
import { TimelineScrollContext, type TimelineScroll } from './scrollContext'
import { isTimelineBottom, nextTimelinePin, shouldShowTimelineJump } from './scrollPolicy'
import { timelineViewState } from './viewState'
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
  const captureFrame = useRef<number | null>(null)
  const [showJump, setShowJump] = useState(false)
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
      writeScrollTop(el, top, undefined, 'opencode')
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
    cancelEntryMotion(el)
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
    if (captureFrame.current === null) {
      captureFrame.current = requestAnimationFrame(() => {
        captureFrame.current = null
        capture()
      })
    }
  }, [capture, state])

  useLayoutEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return
    let frame: number | null = null
    const intent = consumeEntryIntent(sessionKey)
    const placement = entryPolicy(intent ? 'open' : 'resume', 'opencode', {
      pinned: state.pinned,
      scrollTop: state.top,
      anchorKey: state.anchor?.key
    })
    if (placement.action === 'scroll-bottom') {
      state.setPinned(true)
      state.setAnchor(null)
      if (intent)
        startEntryMotion(
          el,
          (top, behavior) => writeScrollTop(el, top, behavior, 'opencode'),
          false
        )
      else writeTop(el.scrollHeight)
    } else if (placement.action === 'restore-saved') {
      writeTop(placement.saved.scrollTop)
    }
    const unpin = (): void => {
      state.setPinned(false)
      capture()
    }
    const wheel = (event: WheelEvent): void => {
      if (nestedScrollConsumes(event.target, el, event.deltaY)) return
      gestureUntil.current = Date.now() + 250
      if (event.deltaY < 0) unpin()
    }
    const key = (event: KeyboardEvent): void => {
      const upward =
        ['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)
      if (nestedScrollConsumes(event.target, el, upward ? -1 : 1)) return
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
      if (nestedScrollConsumes(event.target, el)) return
      capture()
      held.current = true
    }
    const selection = (): void => {
      const value = document.getSelection()
      const start = rowFor(value?.anchorNode ?? null)
      const end = rowFor(value?.focusNode ?? null)
      // A transcript selection unpins (0326 ΔV2: the viewport neither keeps nor restores it).
      if (!value?.isCollapsed && start && end && el.contains(start) && el.contains(end)) unpin()
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
        if (state.pinned && !followEntryMotion(el)) writeTop(el.scrollHeight)
        // While reading history, TranscriptViewport restores the visible character after
        // layout changes. Reapplying the saved row here would override that correction.
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
      cancelEntryMotion(el)
      state.setTop(el.scrollTop)
      if (isTimelineBottom(geometry(el)) && state.pinned) state.setAnchor(null)
      if (captureFrame.current !== null) cancelAnimationFrame(captureFrame.current)
      captureFrame.current = null
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('keydown', key)
      el.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      document.removeEventListener('selectionchange', selection)
    }
  }, [capture, sessionKey, state, writeTop])
  const isPinned = useCallback(() => state.pinned, [state])
  const scroll: TimelineScroll = {
    scrollRef,
    contentRef,
    onScroll,
    showJump,
    scrollToBottom,
    anchored: false,
    isPinned,
    state
  }
  return (
    <TimelineScrollContext.Provider value={scroll}>
      {children(scroll)}
    </TimelineScrollContext.Provider>
  )
}
