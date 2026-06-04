import { useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { WinControls } from './WinControls'
import { Icon } from '../shared/ui/Icon'
import { Button } from '../shared/ui/Button'
import { Popover } from '../shared/ui/Popover'
import { useTweakContext } from '../shared/theme'
import { getPlatform, windowApi } from '../shared/api/ipc'

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅.
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// macOS 는 OS traffic light(우측에서 좌측 12px) 가 헤더 좌측을 덮으므로 brand 영역을
// 80px 만큼 밀어준다. Windows/Linux 는 우측 WinControls.
const isDarwin = (): boolean => getPlatform() === 'darwin'

export interface HeaderProps {
  onOpenSearch: () => void
}

export function Header({ onOpenSearch }: HeaderProps): React.JSX.Element {
  const macOsPadLeft = isDarwin() ? 'pl-[80px]' : 'pl-[14px]'
  const navigate = useNavigate()
  const { t, setTweak } = useTweakContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuAnchorRef = useRef<HTMLButtonElement>(null)

  return (
    <header
      className={`app-frame-header relative flex h-9 flex-none select-none items-center border-b border-border bg-sidebar ${macOsPadLeft} pr-[10px] text-[12px] text-ink2`}
    >
      {/* drag-layer — 헤더 전체를 덮는 absolute 1층. 콘텐츠 클릭은 z=1 의 content-layer 에서. */}
      <div
        className="absolute inset-0"
        style={DRAG_STYLE}
        data-behavior="drag-region"
        aria-hidden
      />
      {/* content-layer — 실제 클릭 가능한 콘텐츠. drag-region 위에 z=1 로 오른다. */}
      <div
        className="app-frame-header-left relative z-[1] flex items-center gap-0.5"
        style={NO_DRAG_STYLE}
        data-behavior="no-drag"
      >
        <Button
          ref={menuAnchorRef}
          iconOnly
          size="small"
          leadingIcon="menu"
          aria-label="시스템 메뉴"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        />
        <Button
          iconOnly
          size="small"
          leadingIcon="panelL"
          aria-label="사이드바 접기"
          pressed={t.sidebarCollapsed}
          onClick={() => setTweak('sidebarCollapsed', !t.sidebarCollapsed)}
        />
        <Button
          iconOnly
          size="small"
          leadingIcon="search"
          aria-label="검색"
          onClick={onOpenSearch}
        />
        <Button
          iconOnly
          size="small"
          leadingIcon="arrowL"
          aria-label="뒤로 가기"
          onClick={() => navigate(-1)}
        />
        <Button
          iconOnly
          size="small"
          leadingIcon="arrowR"
          aria-label="앞으로 가기"
          onClick={() => navigate(1)}
        />
      </div>
      <div className="app-frame-header-center relative z-[1] flex-1" aria-hidden />
      <div
        className="app-frame-header-right relative z-[1] flex items-center"
        style={NO_DRAG_STYLE}
        data-behavior="no-drag"
      >
        <WinControls />
      </div>
      <Popover
        open={menuOpen}
        anchorRef={menuAnchorRef}
        onClose={() => setMenuOpen(false)}
        placement="bottom"
        className="min-w-[160px]"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setMenuOpen(false)
            void windowApi.close()
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] text-ink hover:bg-sidebar"
        >
          <Icon name="power" size={14} />
          <span>종료</span>
        </button>
      </Popover>
    </header>
  )
}
