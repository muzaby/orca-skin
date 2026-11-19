/**
 * Offscreen portal host for chunked selection copy serialization (EP-17 ④ · D-094 · c19).
 *
 * Mounted directly under `document.body` so ancestor panel expansion cannot suppress
 * Chromium `Selection.toString()`. Uses `select-text`, `aria-hidden="true"`, and `pointer-events-none`.
 */
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'

export interface CopySerializationHostProps {
  readonly hostRef: RefObject<HTMLDivElement | null>
  readonly widthPx: number
  readonly children: ReactNode
}

export function CopySerializationHost({
  hostRef,
  widthPx,
  children
}: CopySerializationHostProps): React.JSX.Element | null {
  if (typeof document === 'undefined' || !document.body) return null
  return createPortal(
    <div
      ref={hostRef}
      aria-hidden="true"
      data-copy-serialization-host=""
      className="pointer-events-none fixed top-0 left-[-99999px] select-text"
      style={{ width: widthPx > 0 ? `${widthPx}px` : undefined }}
    >
      {children}
    </div>,
    document.body
  )
}
