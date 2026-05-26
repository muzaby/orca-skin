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
// 자식이 같은 셀을 공유, z-index 로 레이어링.
//   - body              : z=0   (항상 visible)
//   - #app-frame-overlay: modal 활성 시 z=10, 평소 z=-10 (modal backdrop 전용)
//   - #app-frame-modal  : modal 활성 시 z=20, 평소 z=-20 (focus-trap 컨테이너)
//   - #app-frame-debug  : z=30  (TweaksPanel 등 개발 보조 — modal 상태 무관)
// 각 슬롯에 `[grid-area:1/1]` 이 자동 적용되어 같은 셀에 쌓인다.
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

// app-frame-main — nav 라우터의 mount point. Sidebar 우측의 전체 콘텐츠 영역.
// AppRouter 가 이 슬롯에 현재 Page 를 렌더한다 — nav 메뉴 전환 시 이 슬롯의 자식만 swap.
export function FrameMain({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <main
      className="app-frame-main min-h-0 flex-1"
      data-context="route-target"
    >
      {children}
    </main>
  )
}

// #app-frame-overlay — modal backdrop. modal 활성 시 z=10 으로 떠올라 blur + dim +
// pointer block 을 제공. 평소엔 z=-10 으로 body 뒤에 깔려 보이지도 클릭도 되지 않는다.
// children 없음 — 순수 backdrop layer.
export function OverlaySlot({ modalActive }: { modalActive: boolean }): React.JSX.Element {
  return (
    <div
      id="app-frame-overlay"
      className={`bg-black/40 backdrop-blur-sm ${modalActive ? 'z-10' : '-z-10'}`}
      data-state={modalActive ? 'visible' : 'hidden'}
      data-context="overlay"
      aria-hidden
    />
  )
}

// #app-frame-modal — modal panel 호스트. focus-trap + blocks-interaction. 평소엔
// z=-20 으로 backdrop 보다도 뒤로 가 보이지 않고, modal 활성 시 z=20 으로 떠오른다.
// 같은 슬롯에 두 모달이 동시에 존재하지 않으므로 conditional render 로 1개만 노출.
export function ModalSlot({
  children,
  modalActive
}: {
  children: ReactNode
  modalActive: boolean
}): React.JSX.Element {
  return (
    <div
      id="app-frame-modal"
      className={modalActive ? 'z-20' : '-z-20'}
      data-state={modalActive ? 'visible' : 'hidden'}
      data-behavior="focus-trap blocks-interaction"
      data-context="modal"
    >
      {children}
    </div>
  )
}

// #app-frame-debug — TweaksPanel 등 개발 보조 floating UI 호스트. modal 상태와
// 무관하게 상시 양수 z (=30). wrapper 자체는 pointer-events: none — grid cell 전체
// 를 덮어도 backdrop/modal 클릭을 막지 않는다. 자식은 자기 영역만 pointer-events-auto.
export function DebugSlot({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div id="app-frame-debug" className="pointer-events-none z-30" data-context="debug">
      <div className="pointer-events-auto">{children}</div>
    </div>
  )
}
