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

export function deriveRightPanelLayout(activeIds: RightPanelTileId[]): RightPanelLayout {
  const columns: RightPanelColumn[] = []
  for (let i = 0; i < activeIds.length; i += ROWS_PER_COL) {
    columns.push({ col: columns.length, tiles: activeIds.slice(i, i + ROWS_PER_COL) })
  }

  const handles: RightPanelHandle[] = []
  if (activeIds.length > 0) handles.push({ kind: 'outer', axis: 'vertical' })
  for (let col = 1; col < columns.length; col += 1) {
    handles.push({ kind: 'column', axis: 'vertical', col })
  }
  for (const column of columns) {
    if (column.tiles.length > 1) handles.push({ kind: 'row', axis: 'horizontal', col: column.col })
  }

  return { columns, handles }
}
