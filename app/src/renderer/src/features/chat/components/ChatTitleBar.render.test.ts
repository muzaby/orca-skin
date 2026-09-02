// 0213 AT-01 · AT-05 · AT-06 — 타일 메뉴 목록과 미확인 완료 배지의 **프로덕션 배선**.
//
// 이 파일이 생기기 전 `ChatTitleBar` 테스트는 0건이었다(0213 §8). 두 계약이 그래서 잠기지
// 않았다:
//
//   ① 메뉴 목록 — 0205 AT-01 은 `visibleRightPanelTileDefinitions` 를 단언했는데 그 상수의
//      **프로덕션 참조가 0**이었다. 실제 메뉴는 이 파일의 상수가 만든다(§10 EP-02).
//   ② 배지 — 술어(`showsUnseenTaskBadge`)만 잠겨 있었다. 호출을 지우거나 결과를 무시해도
//      술어 테스트는 초록이다(§10 EP-03).
//
// `Popover` 는 닫혀 있으면 `null` 이라 메뉴 항목은 정적 렌더에 나오지 않는다 — 그래서 ①은
// **map 이 실제로 읽는 상수**를 관측하고, 최종 `.map()` 홉은 DOM 환경 부재로 미잠금이다
// (0213 §10). ②는 렌더 산출을 본다.

import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RightPanelColumns } from '../lib/rightPanelLayout'

const { sessionState, unseenCount } = vi.hoisted(() => ({
  sessionState: {
    value: {
      title: '작업 중인 대화',
      messages: [],
      cwd: '/repo',
      worktree: null,
      sessionId: 's1',
      rightPanelTiles: [] as RightPanelColumns,
      rightPanelTileLabels: {} as Record<string, string>
    }
  },
  unseenCount: { value: 0 }
}))

vi.mock('../store/chatStore', () => ({
  chatActions: { toggleRightPanelTile: vi.fn(), selectTask: vi.fn(), setPendingCwd: vi.fn() },
  getActiveChatSession: () => sessionState.value,
  useChatSession: (select: (s: unknown) => unknown) => select(sessionState.value),
  useUnseenSettledTaskCount: () => unseenCount.value
}))
vi.mock('../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key })
}))
// cwd 칩은 이 계약의 대상이 아니다 — 자기 IPC 를 물지 않게 형상만 남긴다.
vi.mock('./CwdButton', () => ({ CwdButton: () => null }))

const { ChatTitleBar, VISIBLE_TILE_REGISTRY } = await import('./ChatTitleBar')

function render(opts: { unseen?: number; activeTiles?: string[] } = {}): string {
  unseenCount.value = opts.unseen ?? 0
  sessionState.value.rightPanelTiles = (
    opts.activeTiles?.length ? [{ id: 'c1', tiles: opts.activeTiles }] : []
  ) as RightPanelColumns
  return renderToStaticMarkup(createElement(ChatTitleBar, {}))
}

const BADGE_ARIA = 'chat.taskTile.badgeAria'

describe('타일 메뉴 목록 — 프로덕션이 읽는 상수 (AT-01 · §10 EP-02)', () => {
  it('메뉴가 정의 순서대로 4종을 담는다 — `작업` 이 돌아왔다', () => {
    expect(VISIBLE_TILE_REGISTRY.map((tile) => tile.id)).toEqual([
      'plan',
      'subagent',
      'task',
      'diff'
    ])
  })

  // 정책 SSOT 를 실제로 읽는가 — 목록을 자기 필터로 다시 만들면 이 단언이 깨지지 않는다
  // (정지가 비어 두 파생의 산출이 같기 때문이다). 그래서 **SSOT 쪽 값과의 대응**을 본다:
  // 정의 목록에서 빠진 id 는 메뉴에도 없어야 하고, 항목은 registry 형상을 갖춰야 한다.
  it('목록·순서가 `visibleRightPanelTileDefinitions` 와 같고 항목이 registry 형상이다', async () => {
    const { visibleRightPanelTileDefinitions } = await import('../lib/rightPanelTiles')
    expect(VISIBLE_TILE_REGISTRY.map((tile) => tile.id)).toEqual(
      visibleRightPanelTileDefinitions.map((tile) => tile.id)
    )
    for (const tile of VISIBLE_TILE_REGISTRY) {
      expect(tile.defaultLabelKey).toBeTruthy()
      expect(tile.Content).toBeTypeOf('function')
    }
  })
})

describe('미확인 완료 배지 — 술어에서 화면까지 (AT-05 · AT-06 · §10 EP-03)', () => {
  it('미확인이 있고 타일이 닫혀 있으면 배지 노드가 렌더된다 — 양성', () => {
    expect(render({ unseen: 2, activeTiles: [] })).toContain(BADGE_ARIA)
  })

  it('타일을 보고 있으면 배지 노드가 없다 — 음성 짝', () => {
    expect(render({ unseen: 2, activeTiles: ['task'] })).not.toContain(BADGE_ARIA)
  })

  it('미확인이 없으면 배지 노드가 없다', () => {
    expect(render({ unseen: 0, activeTiles: [] })).not.toContain(BADGE_ARIA)
  })
})
