import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  // anchor 의 상단에 정렬하여 위로 열린다 (Composer 좌측 하단 + 버튼용).
  // 다른 placement 가 필요해지면 그때 확장.
  className?: string
}

export function Popover({
  open,
  anchorRef,
  onClose,
  children,
  className = ''
}: PopoverProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 6
    })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node | null
      if (panelRef.current?.contains(target ?? null)) return
      if (anchorRef.current?.contains(target ?? null)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      className={`fixed z-50 min-w-[240px] rounded-lg border border-border bg-panel p-1 shadow-lg ${className}`}
      style={{ left: pos.left, bottom: pos.bottom }}
    >
      {children}
    </div>,
    document.body
  )
}
