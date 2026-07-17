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
  // 'start' (default) = anchor 좌측 가장자리 기준(left). 'center' = anchor 중앙 기준
  // (0-size 마우스/커서 앵커는 패널 중앙을 좌표에 맞춤). 'end' = anchor 우측 가장자리
  // 기준(right) — 화면 우측에 붙은 버튼(예: SkillDetail 케밥)이 메뉴를 왼쪽으로 펼쳐 오버플로를 막는다.
  align?: 'start' | 'center' | 'end'
  className?: string
}

interface PopoverPos {
  left?: number
  right?: number
  top?: number
  bottom?: number
}

// 앵커와 floating 패널 사이 간격(px).
const GAP = 6
// flip 판정 시 뷰포트 가장자리에 남겨둘 여유(px).
const EDGE_MARGIN = 8

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

  // 측정 기반 배치: 패널은 open 동안 항상 마운트(아래 render)하되 pos 확정 전엔
  // visibility:hidden 으로 측정 가능 상태를 유지한다. 여기서 패널 실제 높이를 읽어
  // 요청 placement 의 가용 공간과 비교, 부족하면 반대 방향으로 flip 한다 — anchor 가
  // 뷰포트 상/하단에 붙어 메뉴가 렌더 영역을 벗어나는 것을 방지(기본 방향은 유지).
  // 열린 동안 창 리사이즈에도 같은 계산으로 재배치한다(0122) — anchor 정렬(중앙 포함)이
  // 창 크기 변경 후에도 유지된다.
  useLayoutEffect(() => {
    if (!open) return
    const compute = (): void => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const panelW = panelRef.current?.offsetWidth ?? 0
      const startLeft = Math.min(
        Math.max(rect.left, EDGE_MARGIN),
        Math.max(EDGE_MARGIN, window.innerWidth - panelW - EDGE_MARGIN)
      )
      const centerLeft = Math.min(
        Math.max(rect.left + rect.width / 2 - panelW / 2, EDGE_MARGIN),
        Math.max(EDGE_MARGIN, window.innerWidth - panelW - EDGE_MARGIN)
      )
      const endRight = Math.min(
        Math.max(window.innerWidth - rect.right, EDGE_MARGIN),
        Math.max(EDGE_MARGIN, window.innerWidth - panelW - EDGE_MARGIN)
      )
      const horizontal =
        align === 'end'
          ? { right: endRight }
          : { left: align === 'center' ? centerLeft : startLeft }
      const panelH = panelRef.current?.offsetHeight ?? 0
      const spaceAbove = rect.top
      const spaceBelow = window.innerHeight - rect.bottom
      let resolved = placement
      if (placement === 'top' && panelH + GAP + EDGE_MARGIN > spaceAbove) {
        resolved = 'bottom'
      } else if (placement === 'bottom' && panelH + GAP + EDGE_MARGIN > spaceBelow) {
        resolved = 'top'
      }
      if (resolved === 'bottom') {
        setPos({ ...horizontal, top: rect.bottom + GAP })
      } else {
        setPos({ ...horizontal, bottom: window.innerHeight - rect.top + GAP })
      }
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
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

  if (!open) return null

  // pos 미확정 동안에도 패널을 마운트해 높이를 측정한다(visibility:hidden, 화면 밖 좌상단).
  // pos 가 잡히면 실제 위치로 가시화한다. min-width 강제는 두지 않는다 — 패널이 콘텐츠
  // 너비를 그대로 따라가 호버 영역과 메뉴 너비가 일치한다(필요 시 consumer 가 className 로 지정).
  const style: PopoverPos & { visibility?: 'hidden' } = pos ?? {
    top: 0,
    left: 0,
    visibility: 'hidden'
  }

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      className={`app-frame-floating fixed z-50 rounded-lg border border-border bg-panel p-1 shadow-lg ${className}`}
      style={style}
      data-context="floating"
      data-behavior="dismissible"
    >
      {children}
    </div>,
    document.body
  )
}
