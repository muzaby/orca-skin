import { useCallback, useRef, type MouseEvent, type RefObject } from 'react'
import { useDragResize } from '../../../../shared/hooks/useDragResize'
import { useI18n } from '../../../../shared/i18n'
import {
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_ROW_SPLIT,
  PANEL_MAX_WIDTH,
  PANEL_MIN_ROW_SPLIT,
  PANEL_MIN_WIDTH
} from '../../reducer/chatReducer'
import { chatActions, useChatSession } from '../../store/chatStore'

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
// columnRightOf 는 안정 함수라 colIndex 를 useCallback 으로 묶어 getOrigin 을 안정화한다.
export function ColumnResizeSeparator({
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

export function RowSeparator({
  col,
  columnRef
}: {
  col: number
  columnRef: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const { tr } = useI18n()
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
      aria-label={tr('chat.rightpanel.rowResizeAria')}
    >
      <span
        aria-hidden
        className={`${SEPARATOR_CAPSULE} h-1 w-10 -translate-x-1/2 -translate-y-1/2`}
      />
    </div>
  )
}
