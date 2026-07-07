import type { CSSProperties } from 'react'
import { WinControls } from './WinControls'
import { Button } from '../shared/ui/Button'
import { getPlatform } from '../shared/api/ipc'
import { LoginView, SsoDebugSection } from '../features/login'
import { DebugPanel } from '../features/debug'

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅(Header 와 동일).
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// 로그인 게이트가 활성일 때 AppLayout 을 대체하는 풀-프레임 셸. 사이드바/일반 헤더 없이
// 슬림 타이틀바(드래그 영역 + 햄버거 + WinControls)만 두고, 본문 중앙에 LoginView 를 둔다.
// 디버그 패널도 함께 렌더 — 항상-실패 SSO 에 갇히지 않고 bypass 를 켤 수 있게 한다.
export function LoginFrame({
  bootError = null,
  onRetryBoot
}: {
  bootError?: string | null
  onRetryBoot?: () => void
}): React.JSX.Element {
  const macOsPadLeft = getPlatform() === 'darwin' ? 'pl-[80px]' : 'pl-[14px]'
  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label="Orca · 로그인"
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
          <Button iconOnly size="small" leadingIcon="menu" aria-label="메뉴" />
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
          {bootError && (
            <div
              role="alert"
              className="rounded-r4 border border-bad/30 bg-bad/10 p-3 text-center text-[12.5px] text-bad"
            >
              <p className="mb-2 font-semibold">앱 준비 중 문제가 발생했습니다.</p>
              <p className="mb-3 break-words text-ink2">{bootError}</p>
              {onRetryBoot && (
                <Button variant="contained" size="small" onClick={onRetryBoot}>
                  부트 다시 시도
                </Button>
              )}
            </div>
          )}
          <LoginView />
        </div>
      </main>
      {import.meta.env.DEV && <DebugPanel ssoSection={<SsoDebugSection />} />}
    </div>
  )
}
