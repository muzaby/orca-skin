import type { ReactNode } from 'react'

export interface FrameProps {
  children: ReactNode
  label?: string
}

// 루트 셸. `app-frame-root` 는 외부 도구가 셸을 식별하기 위한 구조 마커 — 실제 시각
// 스타일은 동일 element 의 Tailwind 유틸이 진실.
export function Frame({ children, label }: FrameProps): React.JSX.Element {
  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={label}
    >
      {children}
    </div>
  )
}

// app-frame-grid — Header 와 Footer 사이의 z-stack 컨테이너. 1×1 CSS grid 로 모든
// 자식이 같은 셀을 공유, z-index 로 레이어링. body(z0) / overlay(z10) / modal(z20).
// `[&>*]:[grid-area:1/1]` 로 자식이 자동으로 같은 셀에 쌓인다.
export function FrameGrid({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="app-frame-grid relative grid min-h-0 flex-1 grid-cols-1 grid-rows-1 [&>*]:[grid-area:1/1]">
      {children}
    </div>
  )
}

// app-frame-body — Sidebar + Main 의 가로 배치. grid 셀 z=0 레이어.
export function FrameBody({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="app-frame-body z-0 flex min-h-0 min-w-0">{children}</div>
}

// #app-frame-overlay — TweaksPanel 등 blur/dim 없이 floating 으로 떠 있는 보조 UI 호스트.
// z=10. `data-state` 는 보조 마커 — 실제 visibility 는 자식 컴포넌트의 conditional render 가 결정.
export function OverlaySlot({
  children,
  visible
}: {
  children: ReactNode
  visible: boolean
}): React.JSX.Element {
  return (
    <div
      id="app-frame-overlay"
      className="pointer-events-none z-10"
      data-state={visible ? 'visible' : 'hidden'}
      data-context="overlay"
    >
      {/* 자식은 자체 fixed/absolute 로 pointer-events 를 회복. */}
      <div className="pointer-events-auto">{children}</div>
    </div>
  )
}

// #app-frame-modal — Installer / Auth 등 focus-trap + blocks-interaction 모달 호스트.
// z=20. 같은 슬롯에 두 모달이 동시에 존재하지 않으므로 conditional render 로 1개만 노출.
export function ModalSlot({
  children,
  visible
}: {
  children: ReactNode
  visible: boolean
}): React.JSX.Element {
  return (
    <div
      id="app-frame-modal"
      className="z-20"
      data-state={visible ? 'visible' : 'hidden'}
      data-behavior="focus-trap blocks-interaction"
      data-context="modal"
    >
      {children}
    </div>
  )
}
