import { rightPanelTileDefinitions, type RightPanelTileId } from '../../lib/rightPanelTiles'
import { PlanTileContent, PlanTileHeaderActions } from './PlanTileContent'
import { ReservedTileContent } from './ReservedTileContent'
import { SubAgentTileContent, SubAgentTileHeader } from './SubAgentTileContent'

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

// 타일별 헤더 콘텐츠 override(기본 라벨 span 대체). 서브에이전트 타일만 뒤로가기+동적 제목을
// 직접 그린다(상세=Task 제목, 목록='백그라운드 작업'). 나머지는 기본 라벨.
const headerContentById: Partial<Record<RightPanelTileId, React.ComponentType>> = {
  subagent: SubAgentTileHeader
}

export const tileRegistry = rightPanelTileDefinitions.map((tile) => ({
  ...tile,
  Content: contentById[tile.id],
  HeaderActions: headerActionsById[tile.id],
  HeaderContent: headerContentById[tile.id]
}))

export function tileById(id: RightPanelTileId): (typeof tileRegistry)[number] {
  return tileRegistry.find((tile) => tile.id === id) ?? tileRegistry[0]
}
