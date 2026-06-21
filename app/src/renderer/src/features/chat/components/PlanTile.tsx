import { PlanTileContent } from './rightpanel/PlanTileContent'

// Compatibility wrapper for older imports. New 우측 패널 구조에서는 RightPanelTile chrome 이
// 헤더/케밥을 담당하고, 이 컴포넌트는 계획 타일 본문만 렌더한다.
export function PlanTile(): React.JSX.Element {
  return <PlanTileContent />
}
