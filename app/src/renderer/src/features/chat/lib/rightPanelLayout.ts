import type { RightPanelTileId } from './rightPanelTiles'

export const ROWS_PER_COL = 2

export type RightPanelHandle =
  | { kind: 'outer'; axis: 'vertical' }
  | { kind: 'column'; axis: 'vertical'; col: number }
  | { kind: 'row'; axis: 'horizontal'; col: number }

export interface RightPanelColumn {
  col: number
  id: string
  tiles: RightPanelTileId[]
}

export interface RightPanelLayout {
  columns: RightPanelColumn[]
  handles: RightPanelHandle[]
}

// 우측 패널 SSOT 는 *열 구조* — 열마다 안정적 `id` + 타일 목록(열당 최대 ROWS_PER_COL). 평탄
// 리스트가 아니라 열을 명시적으로 들고 있어 한 타일을 제거해도 그 열 안에서만 변하고 다른 열은
// 리플로우되지 않는다. id 는 열 생성 시 한 번 발급돼 타일 추가/제거에도 유지되므로, React 가
// 열을 안정적으로 keyed 할 수 있다(인덱스 keyed 시 좌측 열 제거가 우측 열을 remount 시키는 문제 제거).
export interface RightPanelColumnState {
  id: string
  tiles: RightPanelTileId[]
}
export type RightPanelColumns = RightPanelColumnState[]

// 멤버십/메뉴/타깃 계산용 평탄 뷰. (열 경계는 무시하고 활성 순서만.)
export function flattenColumns(cols: RightPanelColumns): RightPanelTileId[] {
  return cols.flatMap((col) => col.tiles)
}

export function columnsContain(cols: RightPanelColumns, id: RightPanelTileId): boolean {
  return cols.some((col) => col.tiles.includes(id))
}

// column-major 채우기: 이미 있으면 무변경; 없으면 ROWS_PER_COL 미만인 첫 열에 append,
// 그런 열이 없으면 새 열(안정 id 발급)을 만든다.
export function addTileColumnMajor(
  cols: RightPanelColumns,
  id: RightPanelTileId
): RightPanelColumns {
  if (columnsContain(cols, id)) return cols
  const target = cols.findIndex((col) => col.tiles.length < ROWS_PER_COL)
  if (target === -1) return [...cols, { id: crypto.randomUUID(), tiles: [id] }]
  return cols.map((col, i) => (i === target ? { ...col, tiles: [...col.tiles, id] } : col))
}

// 타일을 *그 열 안에서만* 제거한다. 다른 열은 그대로 두고(id 보존), 비게 된 열은 드롭한다.
// 드롭된 열의 인덱스를 함께 돌려줘 호출부가 열-인덱스 키 상태(폭/행분할)를 정합하게 splice 한다.
export function removeTileFromColumns(
  cols: RightPanelColumns,
  id: RightPanelTileId
): { columns: RightPanelColumns; removedCol: number | null } {
  const colIndex = cols.findIndex((col) => col.tiles.includes(id))
  if (colIndex === -1) return { columns: cols, removedCol: null }
  const nextTiles = cols[colIndex].tiles.filter((tile) => tile !== id)
  if (nextTiles.length === 0) {
    return { columns: cols.filter((_, i) => i !== colIndex), removedCol: colIndex }
  }
  return {
    columns: cols.map((col, i) => (i === colIndex ? { ...col, tiles: nextTiles } : col)),
    removedCol: null
  }
}

export function deriveRightPanelLayout(cols: RightPanelColumns): RightPanelLayout {
  const columns: RightPanelColumn[] = cols
    .filter((col) => col.tiles.length > 0)
    .map((col, index) => ({ col: index, id: col.id, tiles: col.tiles }))

  const handles: RightPanelHandle[] = []
  if (columns.length > 0) handles.push({ kind: 'outer', axis: 'vertical' })
  for (let col = 1; col < columns.length; col += 1) {
    handles.push({ kind: 'column', axis: 'vertical', col })
  }
  for (const column of columns) {
    if (column.tiles.length > 1) handles.push({ kind: 'row', axis: 'horizontal', col: column.col })
  }

  return { columns, handles }
}
