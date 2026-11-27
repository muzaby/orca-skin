import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { PanelCloseButton, PanelExpandButton } from './PanelControls'
import { ResizableSidePane } from './ResizableSidePane'

interface DetailSidePaneProps {
  // 바뀌면 패널 수명(크기 조절 상태 등)을 새로 시작한다 — 보통 `<종류>:<항목 id>`.
  lifecycleKey: string
  title: string
  width: number
  expanded: boolean
  onWidthChange: (width: number) => void
  onExpandedChange: (expanded: boolean) => void
  onClose: () => void
  // 패널 section 에 얹는 표식(`data-*`).
  markers?: Record<`data-${string}`, string>
  // 머리줄 버튼에 얹는 behavior 표식의 접두사.
  behavior?: string
  children: ReactNode
}

// 카탈로그 화면의 우측 상세 패널 — 크기 조절·펼치기·닫기·Esc. 가장 가까운
// `data-side-pane-host` 가 펼침을 받는다. 열리면 닫기 버튼에 초점이 간다.
export function DetailSidePane({
  lifecycleKey,
  title,
  width,
  expanded,
  onWidthChange,
  onExpandedChange,
  onClose,
  markers,
  behavior = 'detail',
  children
}: DetailSidePaneProps): React.JSX.Element {
  const { tr } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [])
  return (
    <ResizableSidePane
      expanded={expanded}
      lifecycleKey={lifecycleKey}
      width={width}
      onWidthChange={onWidthChange}
      label={tr('chat.rightpanel.panelResizeAria')}
      className="pt-2"
    >
      <section
        {...markers}
        data-surface-entry=""
        aria-label={title}
        className="app-frame-tile effect-primary-elevated flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-r6 border border-border bg-panel"
        onKeyDown={(event) => {
          // Portaled menus/dialogs own Escape while open.
          if (
            event.key === 'Escape' &&
            !event.defaultPrevented &&
            event.currentTarget.contains(event.target as Node) &&
            !event.currentTarget.ownerDocument.querySelector('[role="menu"], [aria-modal="true"]')
          ) {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border px-2 py-2">
          <h2 className="min-w-0 flex-1 truncate px-1 text-footnote font-normal text-ink2">
            {title}
          </h2>
          <PanelExpandButton
            expanded={expanded}
            data-behavior={`${behavior}:expand`}
            onClick={() => onExpandedChange(!expanded)}
          />
          <PanelCloseButton ref={closeRef} data-behavior={`${behavior}:close`} onClick={onClose} />
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5">{children}</div>
      </section>
    </ResizableSidePane>
  )
}
