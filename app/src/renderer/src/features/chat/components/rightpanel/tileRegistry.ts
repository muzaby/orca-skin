import { rightPanelTileDefinitions, type RightPanelTileId } from '../../lib/rightPanelTiles'
import { PlanTileContent, PlanTileHeaderActions } from './PlanTileContent'
import { DiffTileContent } from './DiffTileContent'
import { GitContextBar } from './GitContextBar'
import { SubAgentTileContent, SubAgentTileHeader } from './SubAgentTileContent'
import { TaskTileContent, TaskTileHeader } from './TaskTileContent'

const contentById: Record<RightPanelTileId, React.ComponentType> = {
  plan: PlanTileContent,
  subagent: SubAgentTileContent,
  task: TaskTileContent,
  diff: DiffTileContent
}

// 타일별 헤더 액션(닫기 버튼 앞에 놓이는 추가 조작). 계획 타일만 복사 버튼을 갖고,
// 나머지는 undefined → 닫기 버튼만 노출된다.
const headerActionsById: Partial<Record<RightPanelTileId, React.ComponentType>> = {
  plan: PlanTileHeaderActions
}

// 타일별 헤더 콘텐츠 override(기본 라벨 span 대체). 상세를 갖는 두 타일이 뒤로가기+동적 제목을
// 직접 그린다(상세=항목 제목, 목록=타일 이름). 나머지는 기본 라벨.
//
// `Partial` 이라 **키를 빠뜨려도 컴파일된다**(0204 §10 EP-13③) — typecheck 가 잡아주지 않는
// 유일한 지점이라, 두 헤더가 실제로 해석되는지는 AT-28 이 렌더 출력으로 단언한다.
const headerContentById: Partial<Record<RightPanelTileId, React.ComponentType>> = {
  subagent: SubAgentTileHeader,
  task: TaskTileHeader,
  diff: GitContextBar
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
