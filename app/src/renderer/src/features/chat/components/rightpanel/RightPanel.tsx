import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ResizableSidePane } from '../../../../shared/ui/ResizableSidePane'
import { PANEL_DEFAULT_ROW_SPLIT, PANEL_DEFAULT_WIDTH } from '../../reducer/chatReducer'
import { useChatSession, useChatStore } from '../../store/chatStore'
import { RIGHT_PANEL_POLICY, type RightPanelTileId } from '../../lib/rightPanelTiles'
import { deriveRightPanelLayout, rightPanelColumnsForAgent } from '../../lib/rightPanelLayout'
import { adjustPanelViewport } from '../../lib/rightPanelViewport'
import { ColumnResizeSeparator } from './PanelResizeSeparators'
import { RightPanelColumn } from './RightPanelColumn'
import { useColumnSlideOnReflow } from '../../hooks/useColumnSlideOnReflow'
import { useI18n } from '../../../../shared/i18n'
import { ArtifactViewer } from './ArtifactViewer'
import {
  closeArtifactViewer,
  setArtifactViewerWidth,
  useArtifactViewerStore
} from '../../store/artifactViewerStore'

export function RightPanel({
  className = '',
  onExpandedChange
}: {
  className?: string
  onExpandedChange?: (sessionKey: string, expanded: boolean) => void
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const activeTiles = useChatSession((s) => s.rightPanelTiles)
  const agentKind = useChatSession((s) => s.agentKind)
  const panelPolicy = RIGHT_PANEL_POLICY[agentKind]
  const activeKey = useChatStore((s) => s.activeKey)
  const selection = useArtifactViewerStore((state) => state.selection)
  const viewer = selection?.sessionKey === activeKey ? selection : null
  const viewerWidth = useArtifactViewerStore((state) => state.widths.transcript)
  const viewerOrigin = useRef<HTMLElement | undefined>(undefined)
  const overviewViewportLeft = useRef(0)
  const [expansion, setExpansion] = useState<{ key: string; id: RightPanelTileId } | null>(null)
  const widths = useChatSession((s) => s.rightPanelColWidths)
  const splits = useChatSession((s) => s.rightPanelRowSplits)
  const reveal = useChatStore((state) => state.sessions[state.activeKey]?.panelReveal)
  const viewportRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(
    () => deriveRightPanelLayout(rightPanelColumnsForAgent(activeTiles, agentKind)),
    [activeTiles, agentKind]
  )
  const expandedTile =
    expansion?.key === activeKey && layout.columns.some((col) => col.tiles.includes(expansion.id))
      ? expansion.id
      : null
  const toggleExpand = (id: RightPanelTileId): void =>
    setExpansion(expandedTile === id ? null : { key: activeKey, id })
  const expanded = viewer ? viewer.expanded : !!expandedTile
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
    if (viewer) {
      viewerOrigin.current = viewer.origin
      if (viewportRef.current) viewportRef.current.scrollLeft = 0
    } else if (viewerOrigin.current) {
      const origin = viewerOrigin.current
      viewerOrigin.current = undefined
      if (viewportRef.current) viewportRef.current.scrollLeft = overviewViewportLeft.current
      if (origin.isConnected && !origin.closest('[inert]')) origin.focus({ preventScroll: true })
    }
  }, [viewer])
  useLayoutEffect(
    () => () => {
      viewerOrigin.current = undefined
      closeArtifactViewer(activeKey)
    },
    [activeKey]
  )

  useLayoutEffect(() => {
    if (viewportRef.current && reveal) adjustPanelViewport(viewportRef.current, reveal.id)
  }, [reveal])
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const clamp = (): void => adjustPanelViewport(viewport)
    clamp()
    const observer = new ResizeObserver(clamp)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [layout, widths])

  if (layout.columns.length === 0 && !viewer) return null

  return (
    <div
      ref={viewportRef}
      onScroll={() => {
        if (!viewer && viewportRef.current)
          overviewViewportLeft.current = viewportRef.current.scrollLeft
      }}
      data-panel-expanded={expandedTile ?? undefined}
      className={`${viewer ? 'contents' : `my-2 mr-2 min-h-0 min-w-0 w-max max-w-[calc(50%-0.5rem)] shrink-0 ${expandedTile ? 'overflow-visible' : 'overflow-x-auto'}`} ${className}`}
    >
      <div
        data-artifact-overview=""
        hidden={!!viewer}
        inert={!!viewer}
        className={`${viewer ? 'hidden' : 'flex'} h-full min-h-0 w-max`}
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
              sessionKey={activeKey}
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
