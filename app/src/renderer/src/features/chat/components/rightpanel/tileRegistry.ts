import { rightPanelTileDefinitions, type RightPanelTileId } from '../../lib/rightPanelTiles'
import { PlanTileContent, PlanTileHeaderActions } from './PlanTileContent'
import { ReservedTileContent } from './ReservedTileContent'
import { SubAgentTileContent } from './SubAgentTileContent'

const contentById: Record<RightPanelTileId, React.ComponentType> = {
  plan: PlanTileContent,
  subagent: SubAgentTileContent,
  reserved1: ReservedTileContent,
  reserved2: ReservedTileContent
}

// 타일별 헤더 액션(닫기 버튼 앞에 놓이는 추가 조작). 계획 타일만 복사 버튼을 갖고,
// 나머지는 undefined → 닫기 버튼만 노출된다.
const headerActionsById: Partial<Record<RightPanelTileId, React.ComponentType>> = {
  plan: PlanTileHeaderActions
}

export const tileRegistry = rightPanelTileDefinitions.map((tile) => ({
  ...tile,
  Content: contentById[tile.id],
  HeaderActions: headerActionsById[tile.id]
}))

export function tileById(id: RightPanelTileId): (typeof tileRegistry)[number] {
  return tileRegistry.find((tile) => tile.id === id) ?? tileRegistry[0]
}
