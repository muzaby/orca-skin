import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

// Preserve a rendered exit only when the host can paint the CSS transition.
// A rapid reopening starts a fresh menu/form while its outer opacity reverses.
export function useSurfacePresence(open: boolean): { present: boolean; instance: number } {
  const reduced = useReducedMotion()
  const animated =
    !reduced && typeof document !== 'undefined' && typeof document.getAnimations === 'function'
  const [state, setState] = useState({ open, retained: open, instance: 0 })
  if (state.open !== open) {
    setState({
      open,
      retained: open || (animated && state.retained),
      instance: state.instance + Number(open)
    })
  }
  useEffect(() => {
    if (open || !animated || !state.retained) return
    const timer = window.setTimeout(
      () => setState((current) => (current.open ? current : { ...current, retained: false })),
      150
    )
    return () => window.clearTimeout(timer)
  }, [open, animated, state.retained])
  return { present: open || (animated && state.retained), instance: state.instance }
}
