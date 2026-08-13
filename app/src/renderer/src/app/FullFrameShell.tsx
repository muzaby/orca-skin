import type { CSSProperties, ReactNode } from 'react'
import { WinControls } from './WinControls'
import { Button } from '../shared/ui/Button'
import { getPlatform } from '../shared/api/ipc'
import { useI18n } from '../shared/i18n'

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅(Header 와 동일).
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// `AppLayout` 을 대체하는 **풀-프레임 셸** — 사이드바/일반 헤더 없이 슬림 타이틀바(드래그 영역
// + 햄버거 + WinControls)만 두고 본문을 중앙에 놓는다.
//
// 두 화면이 이 셸을 쓴다: 부팅 실패(`BootFailureFrame`)와 로그인 게이트(`GateFrame`). 둘은
// 0180 까지 한 파일(`LoginFrame`)이었고 0181 이 게이트를 다시 떼어내면서 타이틀바가 두 벌로
// 복사됐다 — 창 컨트롤 위치·mac 인셋·드래그 영역이 갈리면 두 화면의 크롬이 서로 달라진다.
//
// **창 컨트롤(닫기 포함)은 항상 살아 있다** — 부팅 실패든 로그인 실패든 사용자가 앱을 끌 수
// 있어야 한다(재시도 루프에 가두지 않는다).
export function FullFrameShell({
  screenLabel,
  context,
  children,
  footer
}: {
  screenLabel: string
  // DOM 마커. 게이트처럼 화면을 특정해야 하는 곳만 채운다.
  context?: string
  children: ReactNode
  // 셸 바깥(본문 아래)에 붙는 오버레이. 게이트의 DEV 디버그 패널이 쓴다.
  footer?: ReactNode
}): React.JSX.Element {
  const { tr } = useI18n()
  const macOsPadLeft = getPlatform() === 'darwin' ? 'pl-[80px]' : 'pl-[14px]'
  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={screenLabel}
      {...(context !== undefined ? { 'data-context': context } : {})}
    >
      <header
        className={`app-frame-header relative flex h-9 flex-none select-none items-center bg-bg ${macOsPadLeft} pr-[10px]`}
      >
        <div
          className="absolute inset-0"
          style={DRAG_STYLE}
          data-behavior="drag-region"
          aria-hidden
        />
        <div
          className="relative z-[1] flex items-center"
          style={NO_DRAG_STYLE}
          data-behavior="no-drag"
        >
          <Button iconOnly size="small" leadingIcon="menu" aria-label={tr('common.menu')} />
        </div>
        <div className="relative z-[1] flex-1" aria-hidden />
        <div
          className="relative z-[1] flex items-center"
          style={NO_DRAG_STYLE}
          data-behavior="no-drag"
        >
          <WinControls />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center bg-bg px-6">{children}</main>
      {footer}
    </div>
  )
}
