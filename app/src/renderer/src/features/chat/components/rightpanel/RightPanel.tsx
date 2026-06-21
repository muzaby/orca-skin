import { Fragment, useCallback, useMemo, useRef, type MouseEvent, type RefObject } from 'react'
import { useDragResize } from '../../../../shared/hooks/useDragResize'
import {
  PANEL_DEFAULT_ROW_SPLIT,
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_ROW_SPLIT,
  PANEL_MAX_WIDTH,
  PANEL_MIN_ROW_SPLIT,
  PANEL_MIN_WIDTH
} from '../../reducer/chatReducer'
import { chatActions, useChatSession } from '../../store/chatStore'
import { deriveRightPanelLayout } from '../../lib/rightPanelLayout'
import { tileById } from './tileRegistry'
import { RightPanelTile } from './RightPanelTile'

const SEPARATOR_CAPSULE =
  'absolute left-1/2 top-1/2 rounded-full bg-border-strong opacity-0 transition-opacity duration-150 group-hover/sep:opacity-100 group-active/sep:opacity-100 group-active/sep:bg-ink3'

function VerticalSeparator({
  label,
  onMouseDown
}: {
  label: string
  onMouseDown: (e: MouseEvent) => void
}): React.JSX.Element {
  return (
    <div
      className="app-frame-tile-separator group/sep relative w-3 shrink-0 cursor-col-resize"
      data-behavior="resizable"
      data-axis="vertical"
      data-context="tile"
      data-state="visible"
      onMouseDown={onMouseDown}
      aria-label={label}
    >
      <span
        aria-hidden
        className={`${SEPARATOR_CAPSULE} h-10 w-1 -translate-x-1/2 -translate-y-1/2`}
      />
    </div>
  )
}

function OuterSeparator({
  panelRef
}: {
  panelRef: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const width = useChatSession((s) => s.rightPanelColWidths[0] ?? PANEL_DEFAULT_WIDTH)
  const getOrigin = useCallback(
    (): number => panelRef.current?.getBoundingClientRect().left ?? 0,
    [panelRef]
  )
  const { startResize } = useDragResize({
    getOrigin,
    min: PANEL_MIN_WIDTH,
    max: PANEL_MAX_WIDTH,
    invert: false,
    onChange: (next) => chatActions.setRightPanelColWidth(0, next || width)
  })
  return <VerticalSeparator label="우측 패널 크기 조절" onMouseDown={startResize} />
}

function ColumnSeparator({
  col,
  columnRef
}: {
  col: number
  columnRef: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const width = useChatSession((s) => s.rightPanelColWidths[col - 1] ?? PANEL_DEFAULT_WIDTH)
  const getOrigin = useCallback(
    (): number => columnRef.current?.getBoundingClientRect().left ?? 0,
    [columnRef]
  )
  const { startResize } = useDragResize({
    getOrigin,
    min: PANEL_MIN_WIDTH,
    max: PANEL_MAX_WIDTH,
    onChange: (next) => chatActions.setRightPanelColWidth(col - 1, next || width)
  })
  return <VerticalSeparator label="패널 열 크기 조절" onMouseDown={startResize} />
}

function RowSeparator({
  col,
  columnRef
}: {
  col: number
  columnRef: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const heightRef = useRef(1)
  const getOrigin = useCallback((): number => {
    const rect = columnRef.current?.getBoundingClientRect()
    heightRef.current = Math.max(1, rect?.height ?? 1)
    return rect?.top ?? 0
  }, [columnRef])
  const { startResize } = useDragResize({
    axis: 'y',
    getOrigin,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    onChange: (value) => {
      const frac = value / heightRef.current
      chatActions.setRightPanelRowSplit(
        col,
        Math.max(PANEL_MIN_ROW_SPLIT, Math.min(PANEL_MAX_ROW_SPLIT, frac))
      )
    }
  })

  return (
    <div
      className="app-frame-tile-separator group/sep relative h-3 shrink-0 cursor-row-resize"
      data-behavior="resizable"
      data-axis="horizontal"
      data-context="tile"
      data-state="visible"
      onMouseDown={startResize}
      aria-label="패널 행 크기 조절"
    >
      <span
        aria-hidden
        className={`${SEPARATOR_CAPSULE} h-1 w-10 -translate-x-1/2 -translate-y-1/2`}
      />
    </div>
  )
}

function RightPanelColumn({
  col,
  tiles,
  width,
  split
}: {
  col: number
  tiles: ReturnType<typeof deriveRightPanelLayout>['columns'][number]['tiles']
  width: number
  split: number
}): React.JSX.Element {
  const columnRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={columnRef} className="flex min-h-0 shrink-0 flex-col" style={{ width }}>
      {tiles.map((id, index) => {
        const tile = tileById(id)
        const Content = tile.Content
        const basis =
          tiles.length === 1 ? '100%' : index === 0 ? `${split * 100}%` : `${(1 - split) * 100}%`
        const animation = index === 0 ? 'animate-slide-in-right' : 'animate-slide-in-up'
        return (
          <Fragment key={id}>
            {index > 0 && <RowSeparator col={col} columnRef={columnRef} />}
            <div className={`flex min-h-0 ${animation}`} style={{ flexBasis: basis }}>
              <RightPanelTile id={id} defaultLabel={tile.defaultLabel}>
                <Content />
              </RightPanelTile>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

export function RightPanel({ className = '' }: { className?: string }): React.JSX.Element | null {
  const activeTiles = useChatSession((s) => s.rightPanelTiles)
  const widths = useChatSession((s) => s.rightPanelColWidths)
  const splits = useChatSession((s) => s.rightPanelRowSplits)
  const panelRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => deriveRightPanelLayout(activeTiles), [activeTiles])

  if (layout.columns.length === 0) return null

  return (
    <>
      <OuterSeparator panelRef={panelRef} />
      <div ref={panelRef} className={`my-2 mr-2 flex min-h-0 shrink-0 ${className}`}>
        {layout.columns.map((column, index) => (
          <div key={column.col} className="flex min-h-0 shrink-0">
            {index > 0 && <ColumnSeparator col={column.col} columnRef={panelRef} />}
            <RightPanelColumn
              col={column.col}
              tiles={column.tiles}
              width={widths[column.col] ?? PANEL_DEFAULT_WIDTH}
              split={splits[column.col] ?? PANEL_DEFAULT_ROW_SPLIT}
            />
          </div>
        ))}
      </div>
    </>
  )
}
