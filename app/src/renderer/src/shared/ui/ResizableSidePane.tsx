import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  clampSidePaneWidth,
  resizeSidePaneByKey,
  sidePaneBounds,
  startSidePaneDrag
} from '../hooks/sidePaneResize'

interface ResizableSidePaneProps {
  children: ReactNode
  expanded: boolean
  lifecycleKey: string
  label?: string
  width?: number
  onWidthChange?: (width: number) => void
  className?: string
}

// The nearest positioned data-side-pane-host owns expansion. Keep this wrapper in
// normal flow so expanding a child never reflows or remounts the underlying content.
export function ResizableSidePane({
  children,
  expanded,
  lifecycleKey,
  label,
  width,
  onWidthChange,
  className = ''
}: ResizableSidePaneProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const cancel = useRef<(() => void) | undefined>(undefined)
  const normalScroll = useRef(new Map<HTMLElement, { top: number; left: number }>())
  const [hostWidth, setHostWidth] = useState(1200)
  const resizable = width !== undefined
  const bounds = sidePaneBounds(hostWidth)
  const actualWidth = width === undefined ? undefined : clampSidePaneWidth(width, bounds)
  useLayoutEffect(() => {
    if (!resizable) return
    const host = ref.current?.closest<HTMLElement>('[data-side-pane-host]')
    if (!host) return
    const measure = (): void => setHostWidth(host.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [resizable])
  useLayoutEffect(() => () => cancel.current?.(), [lifecycleKey, expanded])
  useLayoutEffect(() => {
    normalScroll.current.clear()
  }, [lifecycleKey])
  useLayoutEffect(() => {
    if (expanded) return
    for (const [element, position] of normalScroll.current) {
      if (!ref.current?.contains(element)) normalScroll.current.delete(element)
      else {
        element.scrollTo({ top: position.top, left: position.left })
      }
    }
  }, [expanded])
  return (
    <div
      ref={ref}
      onScrollCapture={(event) => {
        if (!expanded && event.target instanceof HTMLElement) {
          normalScroll.current.set(event.target, {
            top: event.target.scrollTop,
            left: event.target.scrollLeft
          })
        }
      }}
      data-resizable-side-pane=""
      className={`flex min-h-0 min-w-0 ${width === undefined ? 'flex-1' : 'shrink-0'} ${className}`}
      style={actualWidth === undefined ? undefined : { width: actualWidth }}
    >
      <div
        data-side-pane-surface=""
        data-side-pane-expanded={expanded || undefined}
        className={
          expanded
            ? 'absolute inset-0 z-30 flex min-h-0 min-w-0 bg-bg p-2'
            : 'flex min-h-0 min-w-0 flex-1'
        }
      >
        {onWidthChange && !expanded && (
          <div
            role="separator"
            tabIndex={0}
            aria-label={label}
            aria-orientation="vertical"
            aria-valuemin={bounds.min}
            aria-valuemax={bounds.max}
            aria-valuenow={actualWidth}
            data-side-pane-resize=""
            className="group/sidepane relative w-2 shrink-0 cursor-col-resize touch-none select-none rounded-r4 hide-focus-ring ring-focus"
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary) return
              event.preventDefault()
              cancel.current?.()
              cancel.current = startSidePaneDrag({
                target: event.currentTarget,
                pointerId: event.pointerId,
                right: ref.current!.getBoundingClientRect().right,
                bounds,
                onChange: onWidthChange,
                onFinish: () => {
                  cancel.current = undefined
                }
              })
            }}
            onKeyDown={(event) => {
              const next = resizeSidePaneByKey(event.key, actualWidth ?? bounds.min, bounds)
              if (next === undefined) return
              event.preventDefault()
              onWidthChange(next)
            }}
          >
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong opacity-50 transition-opacity group-hover/sidepane:opacity-100 group-focus/sidepane:opacity-100 group-active/sidepane:opacity-100"
            />
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
