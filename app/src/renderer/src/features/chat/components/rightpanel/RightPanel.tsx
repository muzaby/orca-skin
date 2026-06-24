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
import { deriveRightPanelLayout } from '../../lib/rightPanelLayout'
import { tileById } from './tileRegistry'
import { RightPanelTile } from './RightPanelTile'
import { useColumnSlideOnReflow } from '../../hooks/useColumnSlideOnReflow'

const SEPARATOR_CAPSULE =
  'absolute left-1/2 top-1/2 rounded-full bg-border-strong opacity-0 transition-opacity duration-150 group-hover/sep:opacity-100 group-active/sep:opacity-100 group-active/sep:bg-ink3'

// 행 grow 트랜지션(transition-[flex-basis] duration-200)이 끝난 뒤 justify-end 고정을 푸는 시각.
const ROW_GROW_MS = 230

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
// columnRightOf 는 안정 함수라 colIndex 를 useCallback 으로 묶어 getOrigin 을 안정화한다.
function ColumnResizeSeparator({
  colIndex,
  columnRightOf,
  label,
  widthClass
}: {
  colIndex: number
  columnRightOf: (index: number) => number
  label: string
  widthClass?: string
}): React.JSX.Element {
  const width = useChatSession((s) => s.rightPanelColWidths[colIndex] ?? PANEL_DEFAULT_WIDTH)
  const getOrigin = useCallback(() => columnRightOf(colIndex), [columnRightOf, colIndex])
  const { startResize } = useDragResize({
    getOrigin,
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
  split
}: {
  col: number
  tiles: ReturnType<typeof deriveRightPanelLayout>['columns'][number]['tiles']
  width: number
  split: number
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
        const t = window.setTimeout(() => setAnchorBottom(false), ROW_GROW_MS)
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
    const HeaderContent = tile.HeaderContent
    const basis =
      tiles.length === 1 ? '100%' : index === 0 ? `${split * 100}%` : `${(1 - split) * 100}%`
    // 분리자/타일을 평탄한 keyed 배열로 — Fragment 로 묶으면 분리자 유무에 따라 자식 위치가
    // 밀려 살아남는 타일이 remount(애니메이션 재생 + 트랜지션 소실)된다. key=id 로 보존한다.
    // 열이 안정 id 로 keyed 라(RightPanel) 기존 타일은 remount 되지 않으므로, animate-tile-in
    // 은 무조건 둬도 실제 새로 mount 되는(토글로 켜진) 타일만 등장 연출된다.
    if (index > 0) {
      children.push(<RowSeparator key={`sep-${id}`} col={col} columnRef={columnRef} />)
    }
    children.push(
      <div
        key={id}
        className="flex min-h-0 animate-tile-in overflow-hidden transition-[flex-basis] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none"
        style={{ flexBasis: basis }}
      >
        <RightPanelTile
          id={id}
          defaultLabel={tile.defaultLabel}
          headerActions={HeaderActions ? <HeaderActions /> : undefined}
          headerContent={HeaderContent ? <HeaderContent /> : undefined}
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
  // 슬라이드 추적 키는 *열 id*(안정) — 열은 id 로 keyed 라 좌측 열 제거 시 우측 열 엘리먼트가
  // 보존되고, id 로 추적해야 실제로 움직인 열만 슬라이드한다(useColumnSlideOnReflow 참고).
  const columnKeys = useMemo(() => layout.columns.map((c) => c.id), [layout])
  const { registerColumn, columnRightOf } = useColumnSlideOnReflow(columnKeys)

  if (layout.columns.length === 0) return null

  return (
    <>
      <ColumnResizeSeparator
        colIndex={0}
        columnRightOf={columnRightOf}
        label="우측 패널 크기 조절"
      />
      <div className={`my-2 mr-2 flex min-h-0 shrink-0 ${className}`}>
        {layout.columns.map((column, index) => (
          <div key={column.id} ref={registerColumn(index)} className="flex min-h-0 shrink-0">
            {index > 0 && (
              <ColumnResizeSeparator
                colIndex={index}
                columnRightOf={columnRightOf}
                label="패널 열 크기 조절"
                widthClass="w-2"
              />
            )}
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
