export const rightPanelTileDefinitions = [
  { id: 'plan', defaultLabel: '계획' },
  { id: 'subagent', defaultLabel: '백그라운드 작업' },
  { id: 'reserved1', defaultLabel: '예약 1' },
  { id: 'reserved2', defaultLabel: '예약 2' }
] as const

export type RightPanelTileId = (typeof rightPanelTileDefinitions)[number]['id']

export const rightPanelTileIds = rightPanelTileDefinitions.map(
  (tile) => tile.id
) as RightPanelTileId[]

export function isRightPanelTileId(value: string): value is RightPanelTileId {
  return rightPanelTileIds.includes(value as RightPanelTileId)
}

export function defaultRightPanelTileLabel(id: RightPanelTileId): string {
  return rightPanelTileDefinitions.find((tile) => tile.id === id)?.defaultLabel ?? id
}
