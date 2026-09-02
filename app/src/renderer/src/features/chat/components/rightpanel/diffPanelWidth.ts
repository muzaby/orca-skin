import { PANEL_DEFAULT_WIDTH, PANEL_MAX_WIDTH } from '../../reducer/chatReducer'

/**
 * `↗` 가 정하는 다음 열 폭 (0211 ΔV4 D-091).
 *
 * 새 전체화면 모드를 만들지 않고 **이미 있는** 열 폭 축을 토글한다 — 저장소에 타일 최대화
 * 개념이 0건이고(실측: `maximize` 는 OS 창 컨트롤 하나뿐), 열 폭은 `SET_RIGHT_PANEL_COL_WIDTH`
 * 가 이미 조절한다. 최대보다 넓게 끌어 둔 열도 기본으로 되돌린다: `>=` 라 새 상태가 생기지 않는다.
 */
export function nextDiffPanelWidth(current: number | undefined): number {
  return (current ?? PANEL_DEFAULT_WIDTH) >= PANEL_MAX_WIDTH ? PANEL_DEFAULT_WIDTH : PANEL_MAX_WIDTH
}
