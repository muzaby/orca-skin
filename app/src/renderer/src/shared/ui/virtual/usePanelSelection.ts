import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import {
  gestureReducer,
  isSuppressed,
  type GestureEvent,
  type GestureState
} from './selectionGuard'
export function usePanelSelection(
  root: RefObject<HTMLElement | null>,
  documentKey: string
): { notify: () => void; suppressed: boolean; onPointerDown: (event: { button: number }) => void } {
  const gesture = useRef<GestureState>('idle')
  const inside = useRef(false)
  const [suppressed, setSuppressed] = useState(false)
  const dispatch = useCallback((event: GestureEvent): void => {
    gesture.current = gestureReducer(gesture.current, event)
    setSuppressed(isSuppressed(gesture.current))
  }, [])
  useLayoutEffect(() => {
    // Layout cleanups run before the replacement document's child mount effects.
    return () => {
      gesture.current = 'idle'
      inside.current = false
      setSuppressed(false)
    }
  }, [documentKey])
  const contains = useCallback(
    (selection: Selection | null | undefined): boolean =>
      !!selection &&
      !selection.isCollapsed &&
      !!root.current &&
      (root.current.contains(selection.anchorNode) || root.current.contains(selection.focusNode)),
    [root]
  )
  useEffect(() => {
    const changed = (): void => {
      const selection = document.getSelection?.()
      inside.current = contains(selection)
      if (inside.current && isSuppressed(gesture.current)) {
        selection?.removeAllRanges()
        inside.current = false
      }
    }
    const up = (): void => dispatch({ type: 'pointerup' })
    const stop = (): void => dispatch({ type: 'pointercancel' })
    document.addEventListener('selectionchange', changed)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', stop, true)
    window.addEventListener('blur', stop)
    return () => {
      document.removeEventListener('selectionchange', changed)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', stop, true)
      window.removeEventListener('blur', stop)
    }
  }, [contains, dispatch])
  const notify = useCallback((): void => {
    const selection = document.getSelection?.()
    if (gesture.current === 'idle' && !inside.current && !contains(selection)) return
    if (selection?.isCollapsed || contains(selection)) selection?.removeAllRanges()
    inside.current = false
    dispatch({ type: 'cancel' })
  }, [contains, dispatch])
  return {
    notify,
    suppressed,
    onPointerDown: (event) => dispatch({ type: 'pointerdown', button: event.button })
  }
}
