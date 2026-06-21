import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject
} from 'react'
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
import { deriveRightPanelLayout, flattenColumns } from '../../lib/rightPanelLayout'
import type { RightPanelTileId } from '../../lib/rightPanelTiles'
import { tileById } from './tileRegistry'
import { RightPanelTile } from './RightPanelTile'
import { useColumnSlideOnReflow } from '../../hooks/useColumnSlideOnReflow'

const SEPARATOR_CAPSULE =
  'absolute left-1/2 top-1/2 rounded-full bg-border-strong opacity-0 transition-opacity duration-150 group-hover/sep:opacity-100 group-active/sep:opacity-100 group-active/sep:bg-ink3'

function VerticalSeparator({
  label,
  onMouseDown,
  widthClass = 'w-3'
}: {
  label: string
  onMouseDown: (e: MouseEvent) => void
  widthClass?: string
}): React.JSX.Element {
  return (
    <div
      className={`app-frame-tile-separator group/sep relative ${widthClass} shrink-0 cursor-col-resize`}
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

// 우측 도킹 패널의 세로 리사이즈 핸들. 외곽 핸들과 열 사이 핸들이 같은 규칙을 따른다 —
// 각 핸들은 *바로 오른쪽 열*(colIndex)의 폭을 조절하고, 그 열의 오른쪽 모서리를 기준으로
// 폭 = colRight - clientX (invert) 로 계산한다. 패널은 우측 도킹이라 오른쪽 모서리가
// 고정되고 왼쪽으로 끌수록 폭이 커진다(마우스 방향 일치). 좌측 도킹 sidebar 와 반대.
// getColRight 는 그 열의 오른쪽 모서리를 드래그 시작 시점에 측정한다(드래그 중에는 오른쪽
// 이웃 열들의 폭이 고정이므로 모서리도 고정).
function ColumnResizeSeparator({
  colIndex,
  getColRight,
  label,
  widthClass
}: {
  colIndex: number
  getColRight: () => number
  label: string
  widthClass?: string
}): React.JSX.Element {
  const width = useChatSession((s) => s.rightPanelColWidths[colIndex] ?? PANEL_DEFAULT_WIDTH)
  const { startResize } = useDragResize({
    getOrigin: getColRight,
    min: PANEL_MIN_WIDTH,
    max: PANEL_MAX_WIDTH,
    invert: true,
    onChange: (next) => chatActions.setRightPanelColWidth(colIndex, next || width)
  })
  return <VerticalSeparator label={label} onMouseDown={startResize} widthClass={widthClass} />
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
      className="app-frame-tile-separator group/sep relative h-2 shrink-0 cursor-row-resize"
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
  split,
  entering
}: {
  col: number
  tiles: ReturnType<typeof deriveRightPanelLayout>['columns'][number]['tiles']
  width: number
  split: number
  // 이번에 새로 등장한(토글로 켜진) 타일 집합 — 이 타일만 animate-tile-in 으로 등장 연출한다.
  // 열 재배치로 remount 된 기존 타일은 여기 없으므로 슬라이드가 재생되지 않는다(RightPanel 참고).
  entering: Set<RightPanelTileId>
}): React.JSX.Element {
  const columnRef = useRef<HTMLDivElement>(null)
  // 2행→1행 제거 시 남은 행이 자라는 방향을 잡는다. 위(0번) 행이 제거되면 남은 행을 바닥에
  // 고정(justify-end)해 *위로* 자라게, 아래(1번) 행이 제거되면 상단 고정(기본)으로 *아래로*
  // 자라게 한다 — flex-basis 트랜지션이 크기를 애니메이션(타일은 keyed 라 remount 안 됨).
  const [anchorBottom, setAnchorBottom] = useState(false)
  const prevTiles = useRef(tiles)

  useLayoutEffect(() => {
    const prev = prevTiles.current
    prevTiles.current = tiles
    if (prev.length === 2 && tiles.length === 1) {
      const topRemoved = prev.findIndex((id) => !tiles.includes(id)) === 0
      setAnchorBottom(topRemoved)
      if (topRemoved) {
        const t = window.setTimeout(() => setAnchorBottom(false), 230)
        return () => window.clearTimeout(t)
      }
    } else {
      setAnchorBottom(false)
    }
    return undefined
  }, [tiles])

  const children: React.JSX.Element[] = []
  tiles.forEach((id, index) => {
    const tile = tileById(id)
    const Content = tile.Content
    const HeaderActions = tile.HeaderActions
    const basis =
      tiles.length === 1 ? '100%' : index === 0 ? `${split * 100}%` : `${(1 - split) * 100}%`
    // 분리자/타일을 평탄한 keyed 배열로 — Fragment 로 묶으면 분리자 유무에 따라 자식 위치가
    // 밀려 살아남는 타일이 remount(애니메이션 재생 + 트랜지션 소실)된다. key=id 로 보존한다.
    if (index > 0) {
      children.push(<RowSeparator key={`sep-${id}`} col={col} columnRef={columnRef} />)
    }
    children.push(
      <div
        key={id}
        className={`flex min-h-0 overflow-hidden transition-[flex-basis] duration-200 ease-out motion-reduce:transition-none${
          entering.has(id) ? ' animate-tile-in motion-reduce:animate-none' : ''
        }`}
        style={{ flexBasis: basis }}
      >
        <RightPanelTile
          id={id}
          defaultLabel={tile.defaultLabel}
          headerActions={HeaderActions ? <HeaderActions /> : undefined}
        >
          <Content />
        </RightPanelTile>
      </div>
    )
  })

  return (
    <div
      ref={columnRef}
      className={`flex min-h-0 shrink-0 flex-col${anchorBottom ? ' justify-end' : ''}`}
      style={{ width }}
    >
      {children}
    </div>
  )
}

export function RightPanel({ className = '' }: { className?: string }): React.JSX.Element | null {
  const activeTiles = useChatSession((s) => s.rightPanelTiles)
  const widths = useChatSession((s) => s.rightPanelColWidths)
  const splits = useChatSession((s) => s.rightPanelRowSplits)
  const layout = useMemo(() => deriveRightPanelLayout(activeTiles), [activeTiles])
  // 열 래퍼 ref(리사이즈 기준점) + 열 제거 시 남은 열을 빈 자리로 슬라이드(FLIP). 래퍼는 (있다면)
  // 왼쪽 분리자 + 열로 구성돼 래퍼의 오른쪽 모서리 = 열의 오른쪽 모서리(우측 도킹 리사이즈 기준).
  // 슬라이드 추적 키는 *열 내용*(tiles) — 인덱스로 추적하면 좌측 열 제거 시 그대로 있는 우측 열이
  // 엉뚱하게 애니메이션된다(useColumnSlideOnReflow 참고).
  const columnKeys = useMemo(() => layout.columns.map((c) => c.tiles.join('|')), [layout])
  const { registerColumn, getColumnRight } = useColumnSlideOnReflow(columnKeys)

  // 새로 토글된 타일만 등장 연출(animate-tile-in)한다. 열이 제거되며 남은 열의 타일이 remount
  // 되어도 직전에 이미 있던 타일이면 연출하지 않아 "빈 자리에서 재생성" 버그를 막는다. 감지는
  // 레이아웃 이펙트에서만 ref 를 만지고(순수 렌더 유지), 등장 타일은 state 로 들고 있다가 비운다.
  const flat = useMemo(() => flattenColumns(activeTiles), [activeTiles])
  const [entering, setEntering] = useState<Set<RightPanelTileId>>(new Set())
  const prevFlat = useRef<RightPanelTileId[]>([])
  useLayoutEffect(() => {
    const added = flat.filter((id) => !prevFlat.current.includes(id))
    prevFlat.current = flat
    if (added.length === 0) {
      setEntering((s) => (s.size === 0 ? s : new Set()))
      return undefined
    }
    setEntering(new Set(added))
    const t = window.setTimeout(() => setEntering(new Set()), 230)
    return () => window.clearTimeout(t)
  }, [flat])

  if (layout.columns.length === 0) return null

  return (
    <>
      <ColumnResizeSeparator
        colIndex={0}
        getColRight={getColumnRight(0)}
        label="우측 패널 크기 조절"
      />
      <div className={`my-2 mr-2 flex min-h-0 shrink-0 ${className}`}>
        {layout.columns.map((column, index) => (
          <div key={column.col} ref={registerColumn(index)} className="flex min-h-0 shrink-0">
            {index > 0 && (
              <ColumnResizeSeparator
                colIndex={index}
                getColRight={getColumnRight(index)}
                label="패널 열 크기 조절"
                widthClass="w-2"
              />
            )}
            <RightPanelColumn
              col={column.col}
              tiles={column.tiles}
              width={widths[column.col] ?? PANEL_DEFAULT_WIDTH}
              split={splits[column.col] ?? PANEL_DEFAULT_ROW_SPLIT}
              entering={entering}
            />
          </div>
        ))}
      </div>
    </>
  )
}
