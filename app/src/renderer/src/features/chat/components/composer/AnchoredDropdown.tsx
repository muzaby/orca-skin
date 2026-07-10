import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface AnchoredDropdownProps {
  open: boolean
  // dropdown 이 부착될 textarea wrapper (HighlightedTextarea 의 outer div).
  anchorRef: RefObject<HTMLElement | null>
  // 항목 수 — 변동 시 재측정 (기존 구현들의 useLayoutEffect deps 보존).
  itemCount: number
  ariaLabel: string
  children: ReactNode
}

// Skill/File 자동완성이 공유하는 anchor-기준 floating listbox 셸 — anchor 의 좌상단
// 바로 위로 열린다 (composer 의 textarea 위쪽에 띄움). caret 좌표를 정확히 추적하지는
// 않고 textarea 의 좌상단을 기준으로 잡아도 충분하다 (composer textarea 는 보통 1~3 줄이며
// dropdown 폭이 textarea 폭에 가까움). VSCode·Slack 의 토큰-시작-기준 정렬과 유사한 시각 효과.
export function AnchoredDropdown({
  open,
  anchorRef,
  itemCount,
  ariaLabel,
  children
}: AnchoredDropdownProps): React.JSX.Element | null {
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
  }, [open, anchorRef, itemCount])

  if (!open || !pos) return null

  return createPortal(
    <div
      role="listbox"
      aria-label={ariaLabel}
      className="app-frame-floating fixed z-50 min-w-[280px] max-w-[420px] overflow-hidden rounded-lg border border-border bg-panel p-1 shadow-lg"
      style={{ left: pos.left, bottom: pos.bottom }}
      data-context="floating"
      data-behavior="dismissible"
    >
      {children}
    </div>,
    document.body
  )
}
