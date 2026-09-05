// 0211 라운드 6 — §10 EP-73 ④ / VP-99 · D-149.
//
// `FAIL_GIT_SNAPSHOT_QUERY` 는 저장소 어디에서도 이름이 불리지 않았다(테스트 참조 0건). 그래서
// **가드 전체를 지워도** 3,366 케이스가 전부 초록이었다(S4) — 취소된 옛 조회의 실패가 방금 시작한
// 새 조회 위에 오류로 내려앉는데 게이트가 조용하다. 사용자에게는 '새로 고침' 을 눌러 조회가
// 도는 중에 이전 실패 안내가 뜬다.
//
// 재시도 버튼의 **존재**는 `diffTileWiring.test.ts` 가 잡는다(EP-73 ①). 여기는 그 실패가
// **언제 실리는가** 다 — 세 축(요청 key · 갱신 세대 · 비교 범위)을 각각 음성으로 확인한다.

import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

const request = { key: 'repo-session', generation: 2 }
const a = { kind: 'commit', sha: 'a' } as const
const b = { kind: 'commit', sha: 'b' } as const

/** 현재 조회가 `request` · 비교 범위 `a` 인 상태. */
function querying(): ChatState {
  const begun = chatReducer(initialChatState, { type: 'BEGIN_GIT_SNAPSHOT_QUERY', request })
  return chatReducer(begun, { type: 'SET_DIFF_COMPARISON', comparison: a })
}

describe('조회 실패는 지금 도는 요청의 것만 싣는다 (EP-73 ④ · VP-99)', () => {
  it('같은 요청·같은 범위의 실패는 오류로 선다', () => {
    const state = chatReducer(querying(), {
      type: 'FAIL_GIT_SNAPSHOT_QUERY',
      request,
      source: 'patch',
      comparison: a
    })

    expect(state.gitSnapshot.error).toBe('patch')
  })

  it('요청 key 가 다른 실패는 무시한다 — 다른 세션/저장소의 응답이다', () => {
    const state = chatReducer(querying(), {
      type: 'FAIL_GIT_SNAPSHOT_QUERY',
      request: { key: 'other-session', generation: 2 },
      source: 'patch',
      comparison: a
    })

    expect(state.gitSnapshot.error).toBeNull()
  })

  it('갱신 세대가 낮은 늦은 실패는 새 조회를 덮지 않는다', () => {
    const state = chatReducer(querying(), {
      type: 'FAIL_GIT_SNAPSHOT_QUERY',
      request: { key: request.key, generation: 1 },
      source: 'summary',
      comparison: a
    })

    expect(state.gitSnapshot.error).toBeNull()
  })

  it('그 사이 비교 범위를 옮겼으면 옛 범위의 실패는 무시한다', () => {
    const moved = chatReducer(querying(), { type: 'SET_DIFF_COMPARISON', comparison: b })

    const state = chatReducer(moved, {
      type: 'FAIL_GIT_SNAPSHOT_QUERY',
      request,
      source: 'patch',
      comparison: a
    })

    expect(state.gitSnapshot.error).toBeNull()
  })

  it('범위를 싣지 않은 실패(요약 조회)는 범위 축을 보지 않는다', () => {
    const moved = chatReducer(querying(), { type: 'SET_DIFF_COMPARISON', comparison: b })

    const state = chatReducer(moved, {
      type: 'FAIL_GIT_SNAPSHOT_QUERY',
      request,
      source: 'summary'
    })

    expect(state.gitSnapshot.error).toBe('summary')
  })
})
