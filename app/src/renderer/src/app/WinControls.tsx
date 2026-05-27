import type { CSSProperties } from 'react'
import { getPlatform, windowApi } from '../shared/api/ipc'

const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// macOS 는 OS 가 traffic light 를 그리므로 우측 컨트롤 없음.
export function WinControls(): React.JSX.Element | null {
  if (getPlatform() === 'darwin') return null

  const base =
    'grid h-[22px] w-[28px] place-items-center rounded border-0 bg-transparent text-ink2 hover:bg-black/[0.06]'
  return (
    <div
      className="app-frame-window-controls ml-auto flex gap-1.5"
      style={NO_DRAG_STYLE}
      data-behavior="no-drag"
    >
      <button
        className={base}
        style={NO_DRAG_STYLE}
        aria-label="Minimize"
        data-behavior="action:window-minimize"
        onClick={() => void windowApi.minimize()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <button
        className={base}
        style={NO_DRAG_STYLE}
        aria-label="Maximize"
        data-behavior="action:window-maximize"
        onClick={() => void windowApi.maximize()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect
            x="1.5"
            y="1.5"
            width="7"
            height="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>
      <button
        className={`${base} hover:!bg-[#e44a3a] hover:!text-white`}
        style={NO_DRAG_STYLE}
        aria-label="Close"
        data-behavior="action:window-close"
        onClick={() => void windowApi.close()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            d="M2 2l6 6M8 2l-6 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
