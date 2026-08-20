import { WinControls } from '../WinControls'
import { getPlatform } from '../../shared/api/ipc'
import { useI18n } from '../../shared/i18n'
import type { CSSProperties } from 'react'

const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

// 대기 화면. 두 자리에서 쓴다 (0194):
//   'boot'     — 부팅 준비 중 (기존)
//   'resuming' — 게이트 통과 후 나머지 Auth 복원 중
//
// **문자열이 아니라 variant 를 받는다** — 호출부가 `tr()` 을 부르게 하면 i18n 조회가 화면
// 바깥으로 샌다. 기본값이 'boot' 라 기존 호출부(`<BootScreen />`)의 DOM 이 그대로다.
export function BootScreen({
  label = 'boot'
}: { label?: 'boot' | 'resuming' } = {}): React.JSX.Element {
  const { tr } = useI18n()
  const resuming = label === 'resuming'
  const screenLabel = resuming ? tr('boot.resumingLabel') : tr('boot.label')
  const srLabel = resuming ? tr('boot.resumingSr') : tr('boot.preparingSr')
  const macOsPadLeft = getPlatform() === 'darwin' ? 'pl-[80px]' : 'pl-[14px]'
  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink"
      data-screen-label={`Orca · ${screenLabel}`}
      aria-busy="true"
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
        <div className="relative z-[1] flex-1" aria-hidden />
        <div
          className="relative z-[1] flex items-center"
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        >
          <WinControls />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center bg-bg" role="status">
        <span className="sr-only">{srLabel}</span>
        <span
          className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-ink motion-reduce:animate-none"
          aria-hidden
        />
      </main>
    </div>
  )
}
