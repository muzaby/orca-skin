// 0211 ΔV6 AT-70·AT-71 / VP-71·VP-72 — 턴 종료 tick 과 컴포저 행 닫기 (D-114·D-115).
//
// 배선의 두 끝을 잰다. main 이 `turn.ended` 를 내는 축은 `adapters/turn-end-hook.test.ts` 가
// 갖고, 여기서는 **renderer 가 그것을 세는가**(§10 EP-46 ④)와 **닫힘이 그 수로 풀리는가**
// (§10 EP-48 ②)를 본다. 둘 중 하나만 있으면 이벤트는 오는데 아무도 세지 않거나, 한 번 닫은
// 행이 영영 돌아오지 않는다.

import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

const recv = (state: ChatState, type: 'turn.ended' | 'turn.aborted'): ChatState =>
  chatReducer(state, {
    type: 'RECV_EVENT',
    event:
      type === 'turn.ended'
        ? { type, sessionId: 's1' }
        : { type, sessionId: 's1', reason: 'user_cancelled' }
  })

describe('턴 종료 tick (AT-71 · §10 EP-46 ④)', () => {
  it('`turn.ended` 마다 1 오른다 — 다른 터미널 이벤트는 올리지 않는다', () => {
    const one = recv(initialChatState, 'turn.ended')
    const two = recv(one, 'turn.ended')

    expect(initialChatState.turnEndTick).toBe(0)
    expect(one.turnEndTick).toBe(1)
    expect(two.turnEndTick).toBe(2)
    // 중단은 작업 결과물을 만들지 않았다 — 계기가 아니다.
    expect(recv(two, 'turn.aborted').turnEndTick).toBe(2)
  })

  it('`turn.ended` 는 terminal 이 아니다 — 진행 상태를 건드리지 않는다', () => {
    const busy = { ...initialChatState, inflight: true, listening: true }
    const after = recv(busy, 'turn.ended')

    expect(after.inflight).toBe(true)
    expect(after.listening).toBe(true)
  })
})

describe('컴포저 행 닫기 (AT-70 · §10 EP-48 ②)', () => {
  it('닫으면 현재 tick 을 적고, 다음 `turn.ended` 가 그 값을 넘긴다', () => {
    const afterTurn = recv(initialChatState, 'turn.ended')
    const closed = chatReducer(afterTurn, { type: 'CLOSE_GIT_ROW' })

    expect(closed.gitRowClosedAtTick).toBe(1)
    expect(closed.turnEndTick).toBe(1)

    const next = recv(closed, 'turn.ended')
    // 표식은 그대로 두고 tick 만 올린다 — 두 값이 갈리는 것이 복귀의 전부다(별도 해제 없음).
    expect(next.gitRowClosedAtTick).toBe(1)
    expect(next.turnEndTick).toBe(2)
  })

  it('다시 닫으면 새 tick 을 적는다 — 매 턴 닫을 수 있다', () => {
    let state = recv(initialChatState, 'turn.ended')
    state = chatReducer(state, { type: 'CLOSE_GIT_ROW' })
    state = recv(state, 'turn.ended')
    state = chatReducer(state, { type: 'CLOSE_GIT_ROW' })

    expect(state.gitRowClosedAtTick).toBe(2)
  })
})

describe('사이드바 세그먼트는 멱등이다 (AT-75 · §10 EP-51 ②)', () => {
  it('같은 값을 두 번 보내도 상태가 뒤집히지 않는다', () => {
    let state = chatReducer(initialChatState, { type: 'SET_DIFF_SIDEBAR_VISIBLE', visible: true })
    expect(state.gitSnapshot.sidebarVisible).toBe(true)

    state = chatReducer(state, { type: 'SET_DIFF_SIDEBAR_VISIBLE', visible: true })
    expect(state.gitSnapshot.sidebarVisible).toBe(true)

    state = chatReducer(state, { type: 'SET_DIFF_SIDEBAR_VISIBLE', visible: false })
    expect(state.gitSnapshot.sidebarVisible).toBe(false)
  })
})
