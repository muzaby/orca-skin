import type { CSSProperties } from 'react'
import { WinControls } from './WinControls'
import { Button } from '../shared/ui/Button'
import { getPlatform } from '../shared/api/ipc'
import { useI18n } from '../shared/i18n'

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅(Header 와 동일).
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// 부팅이 실패했을 때 AppLayout 을 대체하는 풀-프레임 셸. 사이드바/일반 헤더 없이
// 슬림 타이틀바(드래그 영역 + 햄버거 + WinControls)만 두고, 본문 중앙에 실패 사유와
// 재시도 버튼을 둔다.
//
// 0180 이전에는 이 파일이 `LoginFrame` 이었다 — 로그인 게이트와 부팅 실패 화면을 함께
// 맡고 있었다. 게이트가 사라지면서 남은 책임(부팅 실패)만 이름에 반영했다.
export function BootFailureFrame({
  bootError,
  onRetryBoot
}: {
  bootError: string | null
  onRetryBoot?: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const macOsPadLeft = getPlatform() === 'darwin' ? 'pl-[80px]' : 'pl-[14px]'
  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={`Orca · ${tr('boot.errorTitle')}`}
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
      <main className="flex min-h-0 flex-1 items-center justify-center bg-bg px-6">
        <div className="flex w-full max-w-[360px] flex-col gap-4">
          <div
            role="alert"
            className="rounded-r4 border border-bad/30 bg-bad/10 p-3 text-center text-[12.5px] text-bad"
          >
            <p className="mb-2 font-semibold">{tr('boot.errorTitle')}</p>
            {bootError && <p className="mb-3 break-words text-ink2">{bootError}</p>}
            {onRetryBoot && (
              <Button variant="contained" size="small" onClick={onRetryBoot}>
                {tr('boot.retry')}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
