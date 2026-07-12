import { WinControls } from '../WinControls'
import { getPlatform } from '../../shared/api/ipc'
import { useI18n } from '../../shared/i18n'
import type { CSSProperties } from 'react'

const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

export function BootScreen(): React.JSX.Element {
  const { tr } = useI18n()
  const macOsPadLeft = getPlatform() === 'darwin' ? 'pl-[80px]' : 'pl-[14px]'
  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink"
      data-screen-label={`Orca · ${tr('boot.label')}`}
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
        <span className="sr-only">{tr('boot.preparingSr')}</span>
        <span
          className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-ink motion-reduce:animate-none"
          aria-hidden
        />
      </main>
    </div>
  )
}
