import type { MessageKey } from '../../../shared/i18n'

// 타일 기본 라벨은 카탈로그 키만 두고 소비자(RightPanelTile/ChatTitleBar)가 렌더에서
// tr() 해석한다(0096 stale-방지 패턴, 0097). 런타임 라벨(rightPanelTileLabels)이 있으면 우선.
// 0204 D-021 — 4종. `백그라운드 작업`(전용 대화록 상세)과 `작업`(cowork 3섹션)은 별개 타일이고
// (D-015), 늘어난 자리는 예약 슬롯 하나가 내준다. 정의 순서가 곧 타일 메뉴 순서다.
// 0206 D-009 — 남은 예약 슬롯을 `diff` 가 소진한다(4종 유지).
export const rightPanelTileDefinitions = [
  { id: 'plan', defaultLabelKey: 'chat.rightpanel.tiles.plan' },
  { id: 'subagent', defaultLabelKey: 'chat.rightpanel.tiles.subagent' },
  { id: 'task', defaultLabelKey: 'chat.rightpanel.tiles.task' },
  { id: 'diff', defaultLabelKey: 'chat.rightpanel.tiles.diff' }
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

// ── 가시성 정책 (0205) ──────────────────────────────────────────────────────
//
// 두 축이 있고 의미가 다르다. 한 상수로 합치면 "왜 안 보이는가" 가 하나로 뭉개진다.
//
//   정지(suspended)  — cowork 렌더링 모델을 도입하기 전까지 `작업` 타일의 사용자 진입점을
//                      닫는다(0205 D-004). 타일 내용·테스트·i18n 은 그대로 두고 *열리는
//                      경로*만 막는다. **해제는 이 배열을 비우는 것 하나다** — 메뉴·활성화·
//                      배지 세 소비자가 함께 복귀한다.
//   메뉴 비노출      — 정지된 타일은 메뉴에 올리지 않는다. 예약 슬롯도 같았으나 0206 이
//                      마지막 슬롯을 `diff` 로 소진해(D-009) 지금 이 축에 남는 것은
//                      정지 목록뿐이다 — 0205 D-008 은 그래서 대체됐다.
export const SUSPENDED_RIGHT_PANEL_TILES: readonly RightPanelTileId[] = ['task']

export const MENU_HIDDEN_RIGHT_PANEL_TILES: readonly RightPanelTileId[] = [
  ...SUSPENDED_RIGHT_PANEL_TILES
]

// 정지된 타일인가 — reducer 의 활성화 게이트가 부른다.
export function isRightPanelTileSuspended(
  id: RightPanelTileId,
  suspended: readonly RightPanelTileId[] = SUSPENDED_RIGHT_PANEL_TILES
): boolean {
  return suspended.includes(id)
}

// 타일 메뉴에 올릴 정의 — 정의 순서(= 메뉴 순서)를 보존한다.
export const visibleRightPanelTileDefinitions = rightPanelTileDefinitions.filter(
  (tile) => !MENU_HIDDEN_RIGHT_PANEL_TILES.includes(tile.id)
)

// 타일 버튼의 미확인 완료 배지를 띄우는가.
//
// 배지는 "확인하지 않은 완료가 있는데 그 타일을 보고 있지 않다" 를 뜻한다. `작업` 타일이
// 정지되면 `activeTiles` 는 그것을 결코 담지 못하므로 두 번째 조건이 항상 참이 되어 배지가
// 켜진 채 고착한다 — 끄는 3지점(`SELECT_TASK`·`OPEN_TASK`·`ACKNOWLEDGE_SETTLED_TASKS`)이
// 모두 타일 도달을 전제하기 때문이다. 그래서 정지 여부를 함께 본다(0205 D-006).
//
// `suspended` 는 테스트 seam 이다 — 정지 중에는 프로덕션 기본값으로 항상 false 라 양성
// 방향을 만들 수 없다.
export function showsUnseenTaskBadge(
  unseenCount: number,
  activeTiles: readonly RightPanelTileId[],
  suspended: readonly RightPanelTileId[] = SUSPENDED_RIGHT_PANEL_TILES
): boolean {
  if (isRightPanelTileSuspended('task', suspended)) return false
  return unseenCount > 0 && !activeTiles.includes('task')
}
