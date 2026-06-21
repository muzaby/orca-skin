import { rightPanelTileDefinitions, type RightPanelTileId } from '../../lib/rightPanelTiles'
import { PlanTileContent } from './PlanTileContent'
import { ReservedTileContent } from './ReservedTileContent'
import { SubAgentTileContent } from './SubAgentTileContent'

const contentById: Record<RightPanelTileId, React.ComponentType> = {
  plan: PlanTileContent,
  subagent: SubAgentTileContent,
  reserved1: ReservedTileContent,
  reserved2: ReservedTileContent
}

export const tileRegistry = rightPanelTileDefinitions.map((tile) => ({
  ...tile,
  Content: contentById[tile.id]
}))

export function tileById(id: RightPanelTileId): (typeof tileRegistry)[number] {
  return tileRegistry.find((tile) => tile.id === id) ?? tileRegistry[0]
}
