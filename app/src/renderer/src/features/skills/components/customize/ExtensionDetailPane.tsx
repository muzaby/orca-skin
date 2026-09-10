import { useEffect, useRef, type ReactNode } from 'react'
import { PanelCloseButton, PanelExpandButton } from '../../../../shared/ui/PanelControls'
import { ResizableSidePane } from '../../../../shared/ui/ResizableSidePane'
import { useI18n } from '../../../../shared/i18n'
import type { CatalogTab } from '../../lib/catalogSelection'

export function ExtensionDetailPane({
  tab,
  itemId,
  title,
  width,
  expanded,
  onWidthChange,
  onExpandedChange,
  onClose,
  children
}: {
  tab: CatalogTab
  itemId: string
  title: string
  width: number
  expanded: boolean
  onWidthChange: (width: number) => void
  onExpandedChange: (expanded: boolean) => void
  onClose: () => void
  children: ReactNode
}): React.JSX.Element {
  const { tr } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [])
  return (
    <ResizableSidePane
      expanded={expanded}
      lifecycleKey={`${tab}:${itemId}`}
      width={width}
      onWidthChange={onWidthChange}
      label={tr('chat.rightpanel.panelResizeAria')}
      className="pt-2"
    >
      <section
        data-extension-detail-panel={tab}
        data-extension-detail-id={itemId}
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
            data-behavior="extension-detail:expand"
            onClick={() => onExpandedChange(!expanded)}
          />
          <PanelCloseButton
            ref={closeRef}
            data-behavior="extension-detail:close"
            onClick={onClose}
          />
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5">{children}</div>
      </section>
    </ResizableSidePane>
  )
}
