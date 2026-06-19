import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  // 'top' (default) = anchor 위로 열림 (Composer 좌측 하단 버튼용 — 기존 동작).
  // 'bottom' = anchor 아래로 열림 (Header 햄버거 드롭다운용).
  placement?: 'top' | 'bottom'
  // 'start' (default) = anchor 좌측 가장자리 기준(left). 'end' = anchor 우측 가장자리 기준(right)
  // — 화면 우측에 붙은 버튼(예: SkillDetail 케밥)이 메뉴를 왼쪽으로 펼쳐 오버플로를 막는다.
  align?: 'start' | 'end'
  className?: string
}

interface PopoverPos {
  left?: number
  right?: number
  top?: number
  bottom?: number
}

export function Popover({
  open,
  anchorRef,
  onClose,
  children,
  placement = 'top',
  align = 'start',
  className = ''
}: PopoverProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<PopoverPos | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const horizontal =
      align === 'end' ? { right: window.innerWidth - rect.right } : { left: rect.left }
    if (placement === 'bottom') {
      setPos({ ...horizontal, top: rect.bottom + 6 })
    } else {
      setPos({ ...horizontal, bottom: window.innerHeight - rect.top + 6 })
    }
  }, [open, anchorRef, placement, align])

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
      className={`app-frame-floating fixed z-50 min-w-[240px] rounded-lg border border-border bg-panel p-1 shadow-lg ${className}`}
      style={pos}
      data-context="floating"
      data-behavior="dismissible"
    >
      {children}
    </div>,
    document.body
  )
}
