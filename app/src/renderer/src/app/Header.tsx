import { memo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { WinControls } from './WinControls'
import { Icon } from '../shared/ui/Icon'
import { Button } from '../shared/ui/Button'
import { Popover } from '../shared/ui/Popover'
import { Modal } from '../shared/ui/Modal'
import { OrcaLogo } from '../shared/ui/OrcaLogo'
import { useTweakContext } from '../shared/theme'
import { getPlatform, windowApi } from '../shared/api/ipc'
import { updateActions, useUpdateState } from '../features/update'

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅.
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// macOS 는 OS traffic light(우측에서 좌측 12px) 가 헤더 좌측을 덮으므로 brand 영역을
// 80px 만큼 밀어준다. Windows/Linux 는 우측 WinControls.
const isDarwin = (): boolean => getPlatform() === 'darwin'

export interface HeaderProps {
  onOpenSearch: () => void
}

// memo: AppLayout 이 chat 컨텍스트 구독으로 스트리밍 델타 프레임마다 재렌더돼도, 안정 prop
// (onOpenSearch = useCallback) 만 받는 헤더는 건너뛴다. Tweak/라우터 변경 시엔 자체 구독으로
// 정상 재렌더 (0007-transcript-render-memo).
export const Header = memo(function Header({ onOpenSearch }: HeaderProps): React.JSX.Element {
  const macOsPadLeft = isDarwin() ? 'pl-[80px]' : 'pl-[14px]'
  const navigate = useNavigate()
  const { t, setTweak } = useTweakContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const menuAnchorRef = useRef<HTMLButtonElement>(null)
  const updateState = useUpdateState()
  const showUpdateButton = ['available', 'downloading', 'ready', 'installing'].includes(
    updateState.status
  )

  return (
    <header
      className={`app-frame-header relative flex h-9 flex-none select-none items-center bg-bg ${macOsPadLeft} pr-[10px] text-[12px] text-ink2`}
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
        {showUpdateButton && (
          <Button
            iconOnly
            size="small"
            leadingIcon="download"
            aria-label="업데이트"
            pressed={updateState.status === 'ready'}
            busy={updateState.status === 'downloading' || updateState.status === 'installing'}
            onClick={updateActions.openDialog}
          />
        )}
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
            setVersionOpen(true)
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] text-ink hover:bg-sidebar"
        >
          <Icon name="doc" size={14} />
          <span>버전</span>
        </button>
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
      <HeaderVersionModal open={versionOpen} onClose={() => setVersionOpen(false)} />
    </header>
  )
})

function HeaderVersionModal({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  return (
    <Modal
      open={open}
      onClose={onClose}
      blurBackdrop
      ariaLabel="Orca 버전"
      panelClassName="flex w-[280px] max-w-[92vw] flex-col items-center gap-3 rounded-r6 border border-border bg-panel px-8 py-7 text-center shadow-xl"
    >
      <OrcaLogo className="h-10 w-auto text-ink" />
      <div className="font-serif text-[18px] font-semibold tracking-tight text-ink">Orca</div>
      <div className="text-[12.5px] text-ink2">v{__APP_VERSION__}</div>
    </Modal>
  )
}
