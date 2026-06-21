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
        const HeaderActions = tile.HeaderActions
        const basis =
          tiles.length === 1 ? '100%' : index === 0 ? `${split * 100}%` : `${(1 - split) * 100}%`
        // 마운트 연출은 위치 무관 단일 animate-tile-in 으로 통일 — 인덱스(상/하단) 기반 클래스는
        // 형제 제거로 인덱스가 바뀔 때 애니메이션이 재실행돼 grow 대신 슬라이드가 다시 튄다.
        // transition-[flex-basis] 로 2→1 타일 시 남은 타일이 basis 100% 까지 부드럽게 커진다.
        return (
          <Fragment key={id}>
            {index > 0 && <RowSeparator col={col} columnRef={columnRef} />}
            <div
              className="flex min-h-0 animate-tile-in transition-[flex-basis] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none"
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
  // 열별 래퍼 div 의 ref 배열. 래퍼는 (있다면) 왼쪽 분리자 + 열로 구성돼 래퍼의 오른쪽
  // 모서리 = 열의 오른쪽 모서리다. 각 세로 핸들이 자기가 조절하는 열의 오른쪽 모서리를
  // 측정하는 단일 기준점이 된다 — 외곽 핸들은 0열, 열 사이 핸들은 그 오른쪽 열.
  const columnRefs = useRef<Array<HTMLDivElement | null>>([])
  const getColumnRight = useCallback(
    (index: number) => (): number => columnRefs.current[index]?.getBoundingClientRect().right ?? 0,
    []
  )
  const layout = useMemo(() => deriveRightPanelLayout(activeTiles), [activeTiles])

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
          <div
            key={column.col}
            ref={(el) => {
              columnRefs.current[index] = el
            }}
            className="flex min-h-0 shrink-0"
          >
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
            />
          </div>
        ))}
      </div>
    </>
  )
}
