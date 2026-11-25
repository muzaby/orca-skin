import { useEffect, useMemo, useRef } from 'react'
import { idleSearchDirection } from '../lib/idleSearchDirection'
import { chatActions, useChatStore } from '../store/chatStore'
import {
  HISTORY_GESTURE_GAP_MS,
  type TranscriptHistoryControls
} from '../lib/transcript/historyGesture'

export function useHistoryControls(key: string): TranscriptHistoryControls | undefined {
  const page = useChatStore((s) => s.sessions?.[key]?.history)
  const search = useChatStore((s) => s.sessions?.[key]?.search)
  const view = search?.view
  const active = page !== undefined || search !== undefined
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
    const dir = view && idleSearchDirection(view)
    if (view ? !dir : !page || page.before?.kind !== 'withinTurn' || page.beforeState) return
    let idle = 0,
      timer = 0
    function schedule(): void {
      idle = window.requestIdleCallback(() => {
        if (input.current.dragging || performance.now() < input.current.until) {
          timer = window.setTimeout(schedule, HISTORY_GESTURE_GAP_MS)
        } else if (dir) chatActions.readSearchEdge(key, dir, true)
        else chatActions.readPrevious(key, true)
      })
    }
    schedule()
    return () => {
      window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
    }
  }, [key, page, view])
  return useMemo(
    () =>
      view
        ? {
            before: view.beforeState ?? (view.before ? 'ready' : 'end'),
            after: view.afterState ?? (view.after ? 'ready' : 'end'),
            request: (direction) => chatActions.readSearchEdge(key, direction),
            latestState: search?.returning ? 'loading' : search?.returnFailed ? 'error' : undefined,
            returnToLatest: () => chatActions.leaveSearch(key, true)
          }
        : page
          ? {
              before: page.beforeState ?? (page.before ? 'ready' : 'end'),
              request: (direction) => direction === 'before' && chatActions.readPrevious(key)
            }
          : undefined,
    [key, page, view, search?.returning, search?.returnFailed]
  )
}
