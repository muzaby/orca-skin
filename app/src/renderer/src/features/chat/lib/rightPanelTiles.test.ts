// 0213 V1 — `작업` 타일 정지 **해제**의 SSOT 를 잠근다 (AT-01 · AT-07 · AT-05·06).
//
// 0205 가 정지를 잠근 자리를 그대로 되돌린 것이다(0213 D-010) — 지우고 새로 쓰면 무엇이
// 바뀌었는지 알 수 없다. 두 축을 따로 본다. **메뉴 목록**은 목록 자체가 계약이라 직접
// 단언이고, **배지**는 `suspended` seam 으로 두 방향을 모두 본다 — 음성만 단언하면 함수가
// 상수 false 여도 통과한다.

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
  // 0213 D-001 — 정지가 풀려 넷이 됐다. 음성만 두면 아무것도 그리지 않는 회귀가 통과하므로
  // 양성 4종을 순서까지 단언한다.
  it('메뉴 목록은 `계획`·`백그라운드 작업`·`작업`·`변경사항` 넷이고 정의 순서를 지킨다', () => {
    expect(visibleRightPanelTileDefinitions.map((tile) => tile.id)).toEqual([
      'plan',
      'subagent',
      'task',
      'diff'
    ])
  })

  it('타일 정의 자체는 4종 그대로다 — 정지는 제거가 아니었다 (0204 D-021)', () => {
    expect(rightPanelTileIds).toEqual(['plan', 'subagent', 'task', 'diff'])
  })

  it('메뉴에서 빠지는 타일이 없다 — 정지 목록이 비었고 예약 슬롯은 0206 이 diff 로 소진했다', () => {
    expect([...MENU_HIDDEN_RIGHT_PANEL_TILES]).toEqual([])
  })
})

describe('우측 패널 타일 가시성 — 정지 술어 (AT-07 · AT-02·03·04 의 근거)', () => {
  it('프로덕션 정지 목록이 비어 4종 어느 것도 활성화를 막지 않는다 (0213 D-001)', () => {
    expect([...SUSPENDED_RIGHT_PANEL_TILES]).toEqual([])
    expect(isRightPanelTileSuspended('task')).toBe(false)
    expect(isRightPanelTileSuspended('diff')).toBe(false)
    expect(isRightPanelTileSuspended('plan')).toBe(false)
    expect(isRightPanelTileSuspended('subagent')).toBe(false)
  })

  // 양성 짝 — 술어가 상수 false 로 무너져도 위 단언은 통과한다. seam 으로 "정지시키면 참" 을
  // 함께 본다(0205 가 이 함수에 seam 을 남긴 이유가 반대 방향으로 그대로 성립한다).
  it('정지 목록에 넣으면 다시 참이다 — 술어가 배열을 실제로 읽는다', () => {
    expect(isRightPanelTileSuspended('task', ['task'])).toBe(true)
    expect(isRightPanelTileSuspended('plan', ['task'])).toBe(false)
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

  it('프로덕션 기본값(인자 생략)으로도 배지가 뜬다 — 정지 해제 결선 확인 (AT-05)', () => {
    expect(showsUnseenTaskBadge(2, [])).toBe(true)
  })
})
