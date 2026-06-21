import type { RightPanelTileId } from './rightPanelTiles'

export const ROWS_PER_COL = 2

export type RightPanelHandle =
  | { kind: 'outer'; axis: 'vertical' }
  | { kind: 'column'; axis: 'vertical'; col: number }
  | { kind: 'row'; axis: 'horizontal'; col: number }

export interface RightPanelColumn {
  col: number
  tiles: RightPanelTileId[]
}

export interface RightPanelLayout {
  columns: RightPanelColumn[]
  handles: RightPanelHandle[]
}

// 우측 패널 SSOT 는 *열 구조* (RightPanelTileId[][], 열당 최대 ROWS_PER_COL). 평탄 리스트가
// 아니라 열을 명시적으로 들고 있어, 한 타일을 제거해도 그 타일이 속한 열 안에서만 변화가 일어나고
// 다른 열은 리플로우(재패킹) 되지 않는다 — 평탄 리스트 + chunk 파생으로는 불가능했던 위치 안정성.
export type RightPanelColumns = RightPanelTileId[][]

// 멤버십/메뉴/타깃 계산용 평탄 뷰. (열 경계는 무시하고 활성 순서만.)
export function flattenColumns(cols: RightPanelColumns): RightPanelTileId[] {
  return cols.flat()
}

export function columnsContain(cols: RightPanelColumns, id: RightPanelTileId): boolean {
  return cols.some((col) => col.includes(id))
}

// column-major 채우기: 이미 있으면 무변경; 없으면 ROWS_PER_COL 미만인 첫 열에 append,
// 그런 열이 없으면 새 열을 만든다.
export function addTileColumnMajor(
  cols: RightPanelColumns,
  id: RightPanelTileId
): RightPanelColumns {
  if (columnsContain(cols, id)) return cols
  const target = cols.findIndex((col) => col.length < ROWS_PER_COL)
  if (target === -1) return [...cols, [id]]
  return cols.map((col, i) => (i === target ? [...col, id] : col))
}

// 타일을 *그 열 안에서만* 제거한다. 다른 열은 그대로 두고, 비게 된 열은 드롭한다.
// 드롭된 열의 인덱스를 함께 돌려줘 호출부가 열-인덱스 키 상태(폭/행분할)를 정합하게 splice 한다.
export function removeTileFromColumns(
  cols: RightPanelColumns,
  id: RightPanelTileId
): { columns: RightPanelColumns; removedCol: number | null } {
  const colIndex = cols.findIndex((col) => col.includes(id))
  if (colIndex === -1) return { columns: cols, removedCol: null }
  const nextCol = cols[colIndex].filter((tile) => tile !== id)
  if (nextCol.length === 0) {
    return { columns: cols.filter((_, i) => i !== colIndex), removedCol: colIndex }
  }
  return { columns: cols.map((col, i) => (i === colIndex ? nextCol : col)), removedCol: null }
}

export function deriveRightPanelLayout(cols: RightPanelColumns): RightPanelLayout {
  const columns: RightPanelColumn[] = cols
    .filter((tiles) => tiles.length > 0)
    .map((tiles, index) => ({ col: index, tiles }))

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
