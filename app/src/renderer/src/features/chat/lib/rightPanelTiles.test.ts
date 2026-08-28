// 0205 V1 — `작업` 타일 정지의 SSOT 를 잠근다 (AT-01 · AT-04).
//
// 두 축을 따로 본다. **메뉴 비노출**은 목록 자체가 계약이라 직접 단언이고, **배지 정지**는
// 정지 중 프로덕션 기본값으로 항상 false 라 양성 방향을 만들 수 없어 `suspended` seam 을
// 열어 두 방향을 모두 본다 — 음성만 단언하면 함수가 상수 false 여도 통과한다.

import { describe, expect, it } from 'vitest'
import {
  MENU_HIDDEN_RIGHT_PANEL_TILES,
  SUSPENDED_RIGHT_PANEL_TILES,
  isRightPanelTileSuspended,
  rightPanelTileIds,
  showsUnseenTaskBadge,
  visibleRightPanelTileDefinitions
} from './rightPanelTiles'

describe('우측 패널 타일 가시성 — 메뉴 목록 (AT-01)', () => {
  it('메뉴 목록은 `계획`·`백그라운드 작업` 둘이고 정의 순서를 지킨다', () => {
    expect(visibleRightPanelTileDefinitions.map((tile) => tile.id)).toEqual(['plan', 'subagent'])
  })

  it('타일 정의 자체는 4종 그대로다 — 정지는 제거가 아니다 (0204 D-021)', () => {
    expect(rightPanelTileIds).toEqual(['plan', 'subagent', 'task', 'reserved1'])
  })

  it('메뉴 비노출은 예약 슬롯 + 정지된 타일이다', () => {
    expect([...MENU_HIDDEN_RIGHT_PANEL_TILES].sort()).toEqual(['reserved1', 'task'])
  })
})

describe('우측 패널 타일 가시성 — 정지 술어 (AT-02·AT-03 의 근거)', () => {
  it('프로덕션 정지 목록은 `작업` 하나다 — `reserved1` 은 활성화를 막지 않는다 (D-008)', () => {
    expect([...SUSPENDED_RIGHT_PANEL_TILES]).toEqual(['task'])
    expect(isRightPanelTileSuspended('task')).toBe(true)
    expect(isRightPanelTileSuspended('reserved1')).toBe(false)
    expect(isRightPanelTileSuspended('plan')).toBe(false)
    expect(isRightPanelTileSuspended('subagent')).toBe(false)
  })
})

describe('미확인 완료 배지 (AT-04)', () => {
  it('정지되지 않았고 미확인이 있고 타일이 닫혀 있으면 띄운다 — 양성 방향', () => {
    expect(showsUnseenTaskBadge(2, [], [])).toBe(true)
  })

  it('`작업` 이 정지돼 있으면 미확인이 있어도 띄우지 않는다', () => {
    expect(showsUnseenTaskBadge(2, [], ['task'])).toBe(false)
  })

  it('미확인이 없으면 띄우지 않는다', () => {
    expect(showsUnseenTaskBadge(0, [], [])).toBe(false)
  })

  it('타일을 이미 보고 있으면 띄우지 않는다', () => {
    expect(showsUnseenTaskBadge(2, ['task'], [])).toBe(false)
  })

  it('프로덕션 기본값(인자 생략)은 정지를 적용한다 — 결선 확인', () => {
    expect(showsUnseenTaskBadge(2, [])).toBe(false)
  })
})
