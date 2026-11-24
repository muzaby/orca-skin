import { useEffect, useMemo, useRef } from 'react'
import { chatActions, useChatStore } from '../store/chatStore'
import {
  HISTORY_GESTURE_GAP_MS,
  type TranscriptHistoryControls
} from '../lib/transcript/historyGesture'

export function useHistoryControls(key: string): TranscriptHistoryControls | undefined {
  const page = useChatStore((s) => s.sessions?.[key]?.history)
  const active = page !== undefined
  const input = useRef({ until: 0, dragging: false })
  useEffect(() => {
    if (!active) return
    const note = (): void => {
      input.current.until = performance.now() + HISTORY_GESTURE_GAP_MS
    }
    const down = (): void => {
      input.current.dragging = true
      note()
    }
    const up = (): void => {
      input.current.dragging = false
      note()
    }
    document.addEventListener('wheel', note, { capture: true, passive: true })
    document.addEventListener('keydown', note, true)
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    window.addEventListener('blur', up)
    return () => {
      document.removeEventListener('wheel', note, true)
      document.removeEventListener('keydown', note, true)
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      window.removeEventListener('blur', up)
    }
  }, [key, active])
  useEffect(() => {
    if (!page || page.before?.kind !== 'withinTurn' || page.beforeState) return
    let idle = 0,
      timer = 0
    function schedule(): void {
      idle = window.requestIdleCallback(() => {
        if (input.current.dragging || performance.now() < input.current.until) {
          timer = window.setTimeout(schedule, HISTORY_GESTURE_GAP_MS)
        } else chatActions.readPrevious(key, true)
      })
    }
    schedule()
    return () => {
      window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
    }
  }, [key, page])
  return useMemo(
    () =>
      page
        ? {
            before: page.beforeState ?? (page.before ? 'ready' : 'end'),
            request: (direction) => direction === 'before' && chatActions.readPrevious(key)
          }
        : undefined,
    [key, page]
  )
}
