import type { MessageKey } from '../../../shared/i18n'

// 타일 기본 라벨은 카탈로그 키만 두고 소비자(RightPanelTile/ChatTitleBar)가 렌더에서
// tr() 해석한다(0096 stale-방지 패턴, 0097). 런타임 라벨(rightPanelTileLabels)이 있으면 우선.
export const rightPanelTileDefinitions = [
  { id: 'plan', defaultLabelKey: 'chat.rightpanel.tiles.plan' },
  { id: 'task', defaultLabelKey: 'chat.rightpanel.tiles.task' },
  { id: 'reserved1', defaultLabelKey: 'chat.rightpanel.tiles.reserved1' },
  { id: 'reserved2', defaultLabelKey: 'chat.rightpanel.tiles.reserved2' }
] as const satisfies readonly { id: string; defaultLabelKey: MessageKey }[]

export type RightPanelTileId = (typeof rightPanelTileDefinitions)[number]['id']

export const rightPanelTileIds = rightPanelTileDefinitions.map(
  (tile) => tile.id
) as RightPanelTileId[]

export function isRightPanelTileId(value: string): value is RightPanelTileId {
  return rightPanelTileIds.includes(value as RightPanelTileId)
}

export function defaultRightPanelTileLabelKey(id: RightPanelTileId): MessageKey {
  return (
    rightPanelTileDefinitions.find((tile) => tile.id === id)?.defaultLabelKey ??
    rightPanelTileDefinitions[0].defaultLabelKey
  )
}
