import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ResizableSidePane } from '../../../../../shared/ui/ResizableSidePane'
import { PANEL_DEFAULT_ROW_SPLIT, PANEL_DEFAULT_WIDTH } from '../../../reducer/chatReducer'
import { useChatSession, useChatStore } from '../../../store/chatStore'
import type { RightPanelTileId } from '../../../lib/rightPanelTiles'
import type { RightPanelHostProps } from '../../contracts'
import { adjustPanelViewport } from '../../../lib/rightPanelViewport'
import { ColumnResizeSeparator } from './PanelResizeSeparators'
import { RightPanelColumn } from './RightPanelColumn'
import { useColumnSlideOnReflow } from '../../../hooks/useColumnSlideOnReflow'
import { useI18n } from '../../../../../shared/i18n'
import { ArtifactViewer } from './ArtifactViewer'
import { focusPanelOrigin } from './panelFocus'
import {
  closeArtifactViewer,
  setArtifactViewerWidth,
  useArtifactViewerStore
} from '../../../store/artifactViewerStore'

export interface TilePanelDetail {
  key: string
  content: ReactNode
  origin?: HTMLElement
  fallbackOrigin?: HTMLElement
  expanded: boolean
  width: number
  onWidthChange: (width: number) => void
  onClose: () => void
}

export function TilePanel({
  projectName,
  projectPath,
  className = '',
  onExpandedChange,
  detail,
  configuration,
  panelPolicy,
  layout
}: RightPanelHostProps & { detail?: TilePanelDetail }): React.JSX.Element | null {
  const { tr } = useI18n()
  const activeKey = useChatStore((s) => s.activeKey)
  const selection = useArtifactViewerStore((state) => state.selection)
  const viewer = selection?.sessionKey === activeKey ? selection : null
  const viewerWidth = useArtifactViewerStore((state) => state.widths.transcript)
  const viewerOrigin = useRef<HTMLElement | undefined>(undefined)
  const viewerRequest = useRef<number | undefined>(undefined)
  const detailOrigin = useRef<HTMLElement | undefined>(undefined)
  const detailFallbackOrigin = useRef<HTMLElement | undefined>(undefined)
  const detailKey = useRef<string | undefined>(undefined)
  const detailRef = useRef<HTMLDivElement>(null)
  const overlayOpen = !!viewer || !!detail
  const overviewViewportLeft = useRef(0)
  const [expansion, setExpansion] = useState<{ key: string; id: RightPanelTileId } | null>(null)
  const widths = useChatSession((s) => s.rightPanelColWidths)
  const splits = useChatSession((s) => s.rightPanelRowSplits)
  const reveal = useChatStore((state) => state.sessions[state.activeKey]?.panelReveal)
  const appliedReveal = useRef<typeof reveal>(undefined)
  const viewportRef = useRef<HTMLDivElement>(null)
  const expandedTile =
    expansion?.key === activeKey && layout.columns.some((col) => col.tiles.includes(expansion.id))
      ? expansion.id
      : null
  const toggleExpand = (id: RightPanelTileId): void =>
    setExpansion(expandedTile === id ? null : { key: activeKey, id })
  const expanded = viewer ? viewer.expanded : detail ? detail.expanded : !!expandedTile
  useLayoutEffect(() => {
    onExpandedChange?.(activeKey, expanded)
    return () => onExpandedChange?.(activeKey, false)
  }, [activeKey, expanded, onExpandedChange])
  // 열 래퍼 ref(리사이즈 기준점) + 열 제거 시 남은 열을 빈 자리로 슬라이드(FLIP). 래퍼는 (있다면)
  // 왼쪽 분리자 + 열로 구성돼 래퍼의 오른쪽 모서리 = 열의 오른쪽 모서리(우측 도킹 리사이즈 기준).
  // 슬라이드 추적 키는 *열 id*(안정) — 열은 id 로 keyed 라 좌측 열 제거 시 우측 열 엘리먼트가
  // 보존되고, id 로 추적해야 실제로 움직인 열만 슬라이드한다(useColumnSlideOnReflow 참고).
  const columnKeys = useMemo(() => layout.columns.map((c) => c.id), [layout])
  const { registerColumn, columnRightOf } = useColumnSlideOnReflow(columnKeys)

  useLayoutEffect(() => {
    if (useChatStore.getState().activeKey !== activeKey) return
    const focusDetail = (): void => {
      const root = detailRef.current
      ;(root?.querySelector<HTMLElement>('[data-panel-close]') ?? root)?.focus({
        preventScroll: true
      })
    }
    if (detail) {
      if (detailKey.current !== detail.key) {
        detailOrigin.current = detail.origin
        detailFallbackOrigin.current = detail.fallbackOrigin
        if (!viewer) focusDetail()
      }
      detailKey.current = detail.key
    } else {
      detailKey.current = undefined
    }
    if (viewer) {
      viewerOrigin.current = viewer.origin
      viewerRequest.current = viewer.request
      return
    }
    if (viewerRequest.current !== undefined) {
      const origin = viewerOrigin.current
      viewerOrigin.current = undefined
      viewerRequest.current = undefined
      if (focusPanelOrigin(origin)) {
        if (!detail) {
          detailOrigin.current = undefined
          detailFallbackOrigin.current = undefined
        }
        return
      }
      if (detail) focusDetail()
    }
    if (!detail && (detailOrigin.current || detailFallbackOrigin.current)) {
      const origin = detailOrigin.current
      const fallback = detailFallbackOrigin.current
      detailOrigin.current = undefined
      detailFallbackOrigin.current = undefined
      focusPanelOrigin(origin, fallback)
    }
  }, [activeKey, viewer, detail])
  useLayoutEffect(() => {
    if (viewportRef.current)
      viewportRef.current.scrollLeft = overlayOpen ? 0 : overviewViewportLeft.current
  }, [overlayOpen])
  useLayoutEffect(
    () => () => {
      viewerOrigin.current = undefined
      viewerRequest.current = undefined
      detailOrigin.current = undefined
      detailFallbackOrigin.current = undefined
      detailKey.current = undefined
      closeArtifactViewer(activeKey)
    },
    [activeKey]
  )

  useLayoutEffect(() => {
    if (overlayOpen || appliedReveal.current === reveal) return
    appliedReveal.current = reveal
    if (viewportRef.current && reveal) adjustPanelViewport(viewportRef.current, reveal.id)
  }, [reveal, overlayOpen])
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || overlayOpen) return
    const clamp = (): void => adjustPanelViewport(viewport)
    clamp()
    const observer = new ResizeObserver(clamp)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [layout, widths, overlayOpen])

  if (layout.columns.length === 0 && !overlayOpen) return null

  return (
    <div
      ref={viewportRef}
      onScroll={() => {
        if (!overlayOpen && viewportRef.current)
          overviewViewportLeft.current = viewportRef.current.scrollLeft
      }}
      data-panel-expanded={expandedTile ?? undefined}
      className={`${overlayOpen ? 'contents' : `my-2 mr-2 min-h-0 min-w-0 w-max max-w-[calc(50%-0.5rem)] shrink-0 ${expandedTile ? 'overflow-visible' : 'overflow-x-auto'}`} ${className}`}
    >
      <div
        data-artifact-overview=""
        hidden={overlayOpen}
        inert={overlayOpen}
        className={`${overlayOpen ? 'hidden' : 'flex'} h-full min-h-0 w-max`}
      >
        {layout.columns.map((column, index) => (
          <div
            key={column.id}
            ref={registerColumn(index)}
            data-panel-tiles={column.tiles.join(' ')}
            className="flex min-h-0 shrink-0"
          >
            <ColumnResizeSeparator
              colIndex={index}
              columnRightOf={columnRightOf}
              label={tr(
                index === 0 ? 'chat.rightpanel.panelResizeAria' : 'chat.rightpanel.colResizeAria'
              )}
              widthClass="w-2"
            />
            <RightPanelColumn
              projectName={projectName}
              projectPath={projectPath}
              sessionKey={activeKey}
              configuration={configuration}
              col={column.col}
              tiles={column.tiles}
              width={widths[column.col] ?? PANEL_DEFAULT_WIDTH}
              split={splits[column.col] ?? PANEL_DEFAULT_ROW_SPLIT}
              expandedTile={expandedTile}
              onToggleExpand={toggleExpand}
              taskTileChrome={panelPolicy.taskTileChrome}
            />
          </div>
        ))}
      </div>
      {detail && (
        <div
          key={detail.key}
          ref={detailRef}
          data-panel-detail={detail.key}
          hidden={!!viewer}
          inert={!!viewer}
          tabIndex={-1}
          className={viewer ? 'hidden' : 'flex min-h-0 shrink-0 outline-none'}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.defaultPrevented || viewer) return
            const popups = event.currentTarget.ownerDocument.querySelectorAll(
              '[data-context="floating"], [data-behavior="dismissible"]'
            )
            if ([...popups].some((popup) => !popup.closest('[hidden], [inert]'))) return
            event.preventDefault()
            event.stopPropagation()
            detail.onClose()
          }}
        >
          <ResizableSidePane
            expanded={detail.expanded}
            lifecycleKey={`${activeKey}:${detail.key}`}
            width={detail.width}
            onWidthChange={detail.onWidthChange}
            label={tr('chat.rightpanel.panelResizeAria')}
            className="my-2 mr-2"
          >
            {detail.content}
          </ResizableSidePane>
        </div>
      )}
      {viewer && (
        <ResizableSidePane
          expanded={viewer.expanded}
          lifecycleKey={`${viewer.sessionKey}:${viewer.request}`}
          width={viewerWidth}
          onWidthChange={(width) => setArtifactViewerWidth('transcript', width)}
          label={tr('chat.rightpanel.panelResizeAria')}
          className="my-2 mr-2"
        >
          <ArtifactViewer key={`${viewer.sessionKey}:${viewer.request}`} selection={viewer} />
        </ResizableSidePane>
      )}
    </div>
  )
}
