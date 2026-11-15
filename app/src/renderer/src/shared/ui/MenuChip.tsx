import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { Popover } from './Popover'

// 여러 칩이 테두리 하나를 나눠 쓰는 묶음. 안의 칩은 `segment` 로 그린다.
export const MENU_CHIP_GROUP =
  'inline-flex h-7 max-w-full items-stretch divide-x divide-border overflow-hidden rounded-r4 border border-border'

const SURFACE =
  'inline-flex min-w-0 max-w-[220px] cursor-default items-center gap-1.5 px-2.5 text-footnote text-ink2 outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover hover:text-ink aria-expanded:bg-fill-uncontained-hover aria-expanded:text-ink'

interface MenuChipProps {
  // 칩에 보이는 현재 값.
  label: ReactNode
  // 무엇을 고르는 칩인지 — 툴팁과 접근성 이름.
  title: string
  icon?: IconName
  // 아이콘 대신 놓을 글리프(로고 등).
  leading?: ReactNode
  // 묶음(`MENU_CHIP_GROUP`) 안의 칩 — 자기 테두리·반경을 갖지 않는다.
  segment?: boolean
  align?: 'start' | 'end'
  // 값이 아직 없을 때(자리표시 문구) 흐리게 보인다.
  muted?: boolean
  // 펼친 메뉴. `close` 를 불러 닫는다.
  children: (close: () => void) => ReactNode
}

// 현재 값을 보여 주고 누르면 메뉴가 뜨는 칩. 너비는 내용만큼이고 메뉴는 공용 Popover 다.
// Esc 는 메뉴만 닫는다 — 모달 안에서 써도 모달까지 닫히지 않게 한다.
export function MenuChip({
  label,
  title,
  icon,
  leading,
  segment = false,
  align = 'start',
  muted = false,
  children
}: MenuChipProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // 고르고 닫으면 메뉴를 연 칩으로 초점을 돌려준다(렌더 중에는 ref 를 읽지 않는다).
  const [closedByPick, setClosedByPick] = useState(0)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const close = (): void => {
    setOpen(false)
    setClosedByPick((count) => count + 1)
  }
  useEffect(() => {
    if (closedByPick > 0) anchorRef.current?.focus({ preventScroll: true })
  }, [closedByPick])
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      anchorRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open])
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        data-menu-chip=""
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${SURFACE} ${segment ? 'self-stretch' : 'h-7 rounded-r4 border border-border'}`}
      >
        {leading ?? (icon && <Icon name={icon} size={12} className="shrink-0" />)}
        <span className={`min-w-0 truncate ${muted ? 'text-ink3' : ''}`}>{label}</span>
        <Icon name="chevD" size={12} className="shrink-0 text-ink3" />
      </button>
      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        placement="bottom"
        align={align}
      >
        {open && children(close)}
      </Popover>
    </>
  )
}
