import type { CSSProperties } from 'react'
import { WinControls } from '../components/atoms/WinControls'

export interface TitlebarProps {
  project?: string
  breadcrumb?: string | null
}

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅.
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// macOS 는 OS traffic light(우측에서 좌측 12px) 가 헤더 좌측을 덮으므로 brand 영역을
// 80px 만큼 밀어준다. Windows/Linux 는 우측 WinControls.
const isDarwin = (): boolean => typeof window !== 'undefined' && window.orca?.platform === 'darwin'

export function Titlebar({
  project = 'cam-validation-v3',
  breadcrumb
}: TitlebarProps): React.JSX.Element {
  const macOsPadLeft = isDarwin() ? 'pl-[80px]' : 'pl-[14px]'
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
        className="app-frame-header-left relative z-[1] flex items-center gap-2"
        style={NO_DRAG_STYLE}
        data-behavior="no-drag"
      >
        <div className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-rust font-serif text-[12px] font-bold text-white">
          O
        </div>
        <span className="font-serif text-[13px] font-semibold tracking-tight text-ink">Orca</span>
        <span className="text-[11px] text-ink3">—</span>
        <span className="text-[12px] text-ink2">{project}</span>
        {breadcrumb && (
          <>
            <span className="mx-1 text-[11px] text-ink3">›</span>
            <span className="text-[12px] text-ink2">{breadcrumb}</span>
          </>
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
    </header>
  )
}
