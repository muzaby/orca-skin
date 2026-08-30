// 0211 VP-01(소비 절) · VP-02 — 준비 단계 상태의 **수명**.
//
// 강제 지점은 셋이다(§10 EP-04): `BEGIN_TURN` · `session.updated` · `TURN_END_RESET`.
// 하나라도 빠지면 준비가 끝났는데 "워크트리를 만드는 중…" 이 남아 거짓 상태가 된다 —
// 그래서 세 지점을 각각 본다. 대표 하나만 보면 나머지 둘의 누락이 초록으로 통과한다.

import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import type { NormalizedEvent } from '../../../../../shared/ipc'

const recv = (state: ChatState, event: NormalizedEvent): ChatState =>
  chatReducer(state, { type: 'RECV_EVENT', event })

const preparing = (step: 'repo' | 'base' | 'branch' | 'worktree' | 'session'): ChatState =>
  recv(initialChatState, { type: 'worktree.preparing', step })

describe('준비 단계 수신 (VP-01)', () => {
  it('단계를 그대로 담는다 — 추측하지 않는다', () => {
    expect(preparing('branch').worktreePrepareStep).toBe('branch')
    expect(preparing('worktree').worktreePrepareStep).toBe('worktree')
  })

  it('초기 상태에는 단계가 없다 — 준비 중이 아닐 때 문구가 뜨지 않는다', () => {
    expect(initialChatState.worktreePrepareStep).toBeNull()
  })
})

describe('준비 단계 소멸 3지점 (VP-02 · EP-04)', () => {
  it('① BEGIN_TURN — 이전 턴의 단계가 새 턴 첫 프레임에 남지 않는다', () => {
    const next = chatReducer(preparing('worktree'), { type: 'BEGIN_TURN' })
    expect(next.worktreePrepareStep).toBeNull()
  })

  it('② session.updated — 준비가 끝나면 기존 진행 표시로 넘어간다', () => {
    const next = recv(preparing('session'), {
      type: 'session.updated',
      sessionId: 's1',
      patch: {}
    })
    expect(next.worktreePrepareStep).toBeNull()
  })

  it('③ 턴 종료(telemetry) — 턴이 끝났는데 단계가 남으면 거짓 상태다', () => {
    const busy: ChatState = { ...preparing('worktree'), inflight: true }
    const next = recv(busy, { type: 'telemetry', sessionId: 's1' })
    expect(next.inflight).toBe(false)
    expect(next.worktreePrepareStep).toBeNull()
  })

  it('턴 중단도 같은 리셋을 지난다', () => {
    const busy: ChatState = { ...preparing('branch'), inflight: true }
    const next = recv(busy, { type: 'turn.aborted', sessionId: 's1', reason: 'user_cancelled' })
    expect(next.worktreePrepareStep).toBeNull()
  })
})

describe('표시 정본의 수명 (VP-04 · VP-19 · D-020)', () => {
  it('session.updated 의 worktree 를 담는다', () => {
    const next = recv(initialChatState, {
      type: 'session.updated',
      sessionId: 's1',
      patch: { worktree: { sourceCwd: '/repo/orca', repoRoot: '/repo/orca' } }
    })
    expect(next.worktree).toEqual({ sourceCwd: '/repo/orca', repoRoot: '/repo/orca' })
  })

  it('worktree 소실 폴백(patch.cwd 만)은 표시 정본을 지운다 — 사라진 이름이 남지 않는다', () => {
    const managed = recv(initialChatState, {
      type: 'session.updated',
      sessionId: 's1',
      patch: { worktree: { sourceCwd: '/repo/orca', repoRoot: '/repo/orca' } }
    })
    const recovered = recv(managed, {
      type: 'session.updated',
      sessionId: 's1',
      patch: { cwd: '/repo/orca' }
    })
    expect(recovered.worktree).toBeNull()
    expect(recovered.cwd).toBe('/repo/orca')
  })

  it('cwd·worktree 가 둘 다 없는 갱신은 기존 표시를 보존한다 — 무관한 patch 가 이름을 지우지 않는다', () => {
    const managed = recv(initialChatState, {
      type: 'session.updated',
      sessionId: 's1',
      patch: { worktree: { sourceCwd: '/repo/orca', repoRoot: '/repo/orca' } }
    })
    const other = recv(managed, { type: 'session.updated', sessionId: 's1', patch: {} })
    expect(other.worktree).toEqual({ sourceCwd: '/repo/orca', repoRoot: '/repo/orca' })
  })
})
