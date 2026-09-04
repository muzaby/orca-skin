// 0211 라운드 5 — D27·D36 / VP-72 · VP-99 · §10 EP-46 ④ · EP-73 ②.
//
// git 목록 조회의 **두 계기**가 스토어를 지나는 자리다. 턴 종료는 이벤트로, 수동 새로 고침은
// 액션으로 들어온다.
//
// 리듀서(`chatReducer.turnEnd.test.ts`)는 액션이 오면 tick 이 오른다는 것을 잰다. 그런데 그
// 액션을 **만드는 자리**인 `chatStore.receive` 의 `case 'turn.ended'` 를 통째로 지워도 전
// 스위트가 초록이었다 — 이벤트가 리듀서에 닿는 구간이 무관측이었다.
//
// 여기서는 **이벤트를 스토어에 넣는다**. 형제 `turn.aborted` 와 계약이 다르므로(terminal 여부)
// 지우는 변이만으로는 부족하다 — 두 이벤트의 산출을 맞바꾼 변이도 red 여야 한다(라이브 보존 축).

import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { harnessSession, installChatStoreHarness } from './chatStore.testHarness'

const seedLive = (): void => {
  useChatStore.setState((state) => ({
    sessions: {
      ...state.sessions,
      s: { ...state.sessions.s, live: { text: '작성 중', reasoning: '' } }
    }
  }))
}

beforeEach(() => {
  installChatStoreHarness({ inflight: true, turnStartedAt: 1 })
})

describe('`turn.ended` 스토어 라우팅 (D27 · VP-72 · EP-46 ④)', () => {
  it('이벤트마다 세션의 `turnEndTick` 이 1 오른다', () => {
    expect(harnessSession().turnEndTick).toBe(0)

    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(harnessSession().turnEndTick).toBe(1)

    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })
    expect(harnessSession().turnEndTick).toBe(2)
  })

  it('terminal 이 아니다 — 라이브 프리뷰와 진행 상태를 건드리지 않는다', () => {
    seedLive()

    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })

    const entry = useChatStore.getState().sessions.s
    expect(entry.live).toEqual({ text: '작성 중', reasoning: '' })
    expect(entry.session.inflight).toBe(true)
  })

  it('형제 `turn.aborted` 는 같은 자리에서 다른 일을 한다 — 산출을 맞바꾸면 갈린다', () => {
    seedLive()

    ingestChatEvent({ type: 'turn.aborted', sessionId: 's', reason: 'user_cancelled' })

    const entry = useChatStore.getState().sessions.s
    // 중단은 라이브를 버리고 진행을 닫는다. 계기는 올리지 않는다.
    expect(entry.live).toEqual({ text: '', reasoning: '' })
    expect(entry.session.inflight).toBe(false)
    expect(entry.session.turnEndTick).toBe(0)
  })
})

describe('수동 새로 고침 계기 (D36 · VP-99 · EP-73 ②)', () => {
  it('`refreshGitSnapshot` 이 활성 세션의 `gitRefreshTick` 을 올린다', () => {
    expect(harnessSession().gitRefreshTick).toBe(0)

    chatActions.refreshGitSnapshot()
    expect(harnessSession().gitRefreshTick).toBe(1)

    chatActions.refreshGitSnapshot()
    expect(harnessSession().gitRefreshTick).toBe(2)
  })

  it('턴 종료 계기와 서로 다른 축이다 — 하나가 다른 하나를 올리지 않는다', () => {
    chatActions.refreshGitSnapshot()
    ingestChatEvent({ type: 'turn.ended', sessionId: 's' })

    expect(harnessSession().gitRefreshTick).toBe(1)
    expect(harnessSession().turnEndTick).toBe(1)
  })
})
