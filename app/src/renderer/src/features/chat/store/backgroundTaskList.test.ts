// 0231 VP-208 (R-104 ↔ AT-107 · §10 EP-204) — 실행 줄 클릭은 **목록**을 연다.
//
// `openSubagentTask` 와 다른 동작임을 함께 단언한다: 하나만 보면 두 액션을 같은 것으로 합친
// 변이가 통과하고, 그 변이는 셸 작업에서 죽은 어포던스가 된다(0230 R-03).

import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

const selected = (): string | null =>
  useChatStore.getState().sessions.s.session.selectedSubagentTaskId ?? null

const subagentTileActive = (): boolean =>
  useChatStore
    .getState()
    .sessions.s.session.rightPanelTiles.some((column) => column.tiles.includes('subagent'))

beforeEach(() => {
  installChatStoreHarness()
})

describe('0231 EP-204 — 백그라운드 작업 목록 열기', () => {
  it('AT-107 — 타일을 활성화하고 선택을 비운다(= 목록이 선다)', () => {
    chatActions.openBackgroundTaskList()
    expect(subagentTileActive()).toBe(true)
    expect(selected()).toBeNull()
  })

  it('개별 상세가 열려 있어도 목록으로 되돌린다', () => {
    chatActions.openSubagentTask('task-1')
    expect(selected()).toBe('task-1')
    chatActions.openBackgroundTaskList()
    expect(selected()).toBeNull()
  })

  it('형제 대조: `openSubagentTask` 는 여전히 개별 상세를 연다', () => {
    chatActions.openBackgroundTaskList()
    chatActions.openSubagentTask('task-2')
    expect(selected()).toBe('task-2')
  })
})
