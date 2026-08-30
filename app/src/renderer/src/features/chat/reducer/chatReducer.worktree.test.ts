import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState } from './chatReducer'

describe('chatReducer worktree isolation', () => {
  it('새 draft 기본값은 off이고 사용자가 켠 뒤 NEW_CHAT에서 다시 off다', () => {
    expect(initialChatState.worktreeIsolation).toBe(false)
    const enabled = chatReducer(initialChatState, { type: 'SET_WORKTREE_ISOLATION', enabled: true })
    expect(enabled.worktreeIsolation).toBe(true)
    expect(chatReducer(enabled, { type: 'NEW_CHAT' }).worktreeIsolation).toBe(false)
  })
})

// AC17 소비자 쪽 — main 이 폴백을 알리는 유일한 경로가 `session.updated.patch.cwd` 다.
// 이 단언이 없으면 main 이 이벤트를 보내도 화면은 죽은 경로에 머문다.
describe('chatReducer — worktree 폴백 통지 (AC17)', () => {
  it('session.updated 의 patch.cwd 가 세션 cwd 를 옮긴다', () => {
    const started = { ...initialChatState, sessionId: 's1', cwd: '/wt/repo-1234abcd/work-x' }
    const next = chatReducer(started, {
      type: 'RECV_EVENT',
      event: { type: 'session.updated', sessionId: 's1', patch: { cwd: '/repo' } }
    })
    expect(next.cwd).toBe('/repo')
  })

  it('patch 에 cwd 가 없으면 기존 값을 유지한다 — 일반 init 이 경로를 지우지 않는다', () => {
    const started = { ...initialChatState, sessionId: 's1', cwd: '/repo' }
    const next = chatReducer(started, {
      type: 'RECV_EVENT',
      event: { type: 'session.updated', sessionId: 's1', patch: {} }
    })
    expect(next.cwd).toBe('/repo')
  })
})

// D-101 의 조건절 — 유예 값은 격리에 매인다.
describe('chatReducer — 유예된 기준 브랜치 (AC7)', () => {
  it('격리를 끄면 유예된 브랜치도 비워진다', () => {
    const picked = chatReducer(
      chatReducer(initialChatState, { type: 'SET_WORKTREE_ISOLATION', enabled: true }),
      { type: 'SET_WORKTREE_BASE_REF', branch: 'feature' }
    )
    expect(picked.worktreeBaseRef).toBe('feature')
    expect(
      chatReducer(picked, { type: 'SET_WORKTREE_ISOLATION', enabled: false }).worktreeBaseRef
    ).toBeNull()
  })

  it('작업 경로가 바뀌면 다른 저장소의 브랜치는 남지 않는다', () => {
    const picked = chatReducer(
      chatReducer(initialChatState, { type: 'SET_WORKTREE_ISOLATION', enabled: true }),
      { type: 'SET_WORKTREE_BASE_REF', branch: 'feature' }
    )
    expect(chatReducer(picked, { type: 'SET_CWD', cwd: '/other' }).worktreeBaseRef).toBeNull()
  })
})
