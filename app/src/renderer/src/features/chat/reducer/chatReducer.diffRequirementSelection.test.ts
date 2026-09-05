// 0211 라운드 7 — D50·D51 / VP-97 · §10 EP-71 ① · D-147.
//
// 불변식: **활성 코멘트 id 는 그 코멘트가 현재 화면의 대상이 아니게 되는 모든 자리에서 비워진다.**
//
// 라운드 6 까지 이 불변식의 오라클은 **한 자리**뿐이었다(성공 clear — `chatStore.test.ts:573`).
// 그래서 삭제·범위 전환·cwd 초기화에서 활성 id 를 안 지워도 게이트가 조용했고, 사용자에게는
// 사라진 코멘트가 계속 선택된 것으로 보인다.
//
// 처방은 세 자리를 말했지만 계약은 불변식이라 **자리를 전수로 세어** 닫는다. `activeDiffRequirementId`
// 를 비우는 자리는 리듀서에 여덟이다:
//   ① `SET_DIFF_COMPARISON`               수동 범위 전환
//   ② `SELECT_DIFF_REQUIREMENT(id=null)`  명시 해제
//   ③ `RECEIVE_GIT_SNAPSHOT_SUMMARY`      범위가 바뀐 요약 수신
//   ④ `REMOVE_DIFF_REQUIREMENT`           삭제
//   ⑤ `SET_DIFF_REQUIREMENT_DRAFT`        draft 열기 (D51)
//   ⑥ `CLEAR_DIFF_REQUIREMENTS_IF_UNCHANGED` 성공 clear (라운드 6 이전부터 잠김)
//   ⑦ `resetGitReview` @ `session.updated` 의 cwd 변경
//   ⑧ `resetGitReview` @ `SET_CWD`
// 재열거 명령: `rg -n 'activeDiffRequirementId' chatReducer.ts` (쓰기 8 = 비움 6 + 세움 2) +
// `rg -n 'resetGitReview' chatReducer.ts` (정의 1 + 호출부 2).
//
// **양성 짝을 함께 둔다** — 전부 `null` 로 만드는 구현이면 음성 단언만으로는 통과한다.

import { describe, expect, it } from 'vitest'
import type { DiffRequirementItem, GitDiffSummary } from '../../../../../shared/ipc'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import { ALL_CHANGES } from '../components/rightpanel/diffComparison'

const SHA = 'a'.repeat(40)

const item = (id: string): DiffRequirementItem => ({
  id,
  located: true,
  anchor: {
    sessionId: 's',
    baselineCommit: 'base',
    filePath: 'src/a.ts',
    oldLine: 2,
    newLine: 2,
    hunkHeader: '',
    contextBefore: [],
    contextAfter: [],
    comment: `Comment ${id}`,
    createdAt: 1
  }
})

const summary = (ref: string): GitDiffSummary => ({
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'b'.repeat(40), ref },
  files: [],
  totals: { added: 0, removed: 0 },
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
})

/** 코멘트 하나가 선택된 상태 — 여덟 자리의 공통 출발점이다. */
function selected(overrides: Partial<ChatState> = {}): ChatState {
  return {
    ...initialChatState,
    sessionId: 's',
    cwd: '/repo',
    diffRequirements: [item('one'), item('two')],
    activeDiffRequirementId: 'one',
    diffRequirementsRevision: 3,
    ...overrides
  }
}

const draft = {
  key: JSON.stringify(['src/a.ts', null, 5]),
  filePath: 'src/a.ts',
  oldLine: null,
  newLine: 5,
  body: ''
}

describe('활성 코멘트는 대상이 아니게 되는 자리마다 비워진다 (EP-71 ① · D-147)', () => {
  it('① 수동 범위 전환 — 다른 커밋을 고르면 이전 선택이 남지 않는다', () => {
    const next = chatReducer(selected(), {
      type: 'SET_DIFF_COMPARISON',
      comparison: { kind: 'commit', sha: SHA }
    })

    expect(next.activeDiffRequirementId).toBeNull()
    expect(next.diffRequirementDraft).toBeNull()
  })

  it('② 명시 해제 — `null` 선택은 활성만 비우고 목록은 남긴다', () => {
    const next = chatReducer(selected(), { type: 'SELECT_DIFF_REQUIREMENT', id: null })

    expect(next.activeDiffRequirementId).toBeNull()
    expect(next.diffRequirements).toHaveLength(2)
  })

  it('③ 범위가 바뀐 요약 수신 — 바뀌었을 때만 비운다', () => {
    const request = { key: 'repo-s', generation: 1 }
    const base = selected({
      gitSnapshotRequest: request,
      gitSnapshot: { ...initialChatState.gitSnapshot, comparison: { kind: 'commit', sha: SHA } }
    })

    const moved = chatReducer(base, {
      type: 'RECEIVE_GIT_SNAPSHOT_SUMMARY',
      request,
      summary: summary('main')
    })
    expect(moved.activeDiffRequirementId).toBeNull()

    // 양성 짝 — 같은 범위로 온 요약은 선택을 건드리지 않는다.
    const same = chatReducer(
      selected({
        gitSnapshotRequest: request,
        gitSnapshot: { ...initialChatState.gitSnapshot, comparison: ALL_CHANGES }
      }),
      { type: 'RECEIVE_GIT_SNAPSHOT_SUMMARY', request, summary: summary('main') }
    )
    expect(same.activeDiffRequirementId).toBe('one')
  })

  it('④ 삭제 — 지운 것이 활성일 때만 비운다', () => {
    expect(
      chatReducer(selected(), { type: 'REMOVE_DIFF_REQUIREMENT', id: 'one' })
        .activeDiffRequirementId
    ).toBeNull()

    // 양성 짝 — 다른 항목을 지우면 활성은 그대로다.
    const other = chatReducer(selected(), { type: 'REMOVE_DIFF_REQUIREMENT', id: 'two' })
    expect(other.activeDiffRequirementId).toBe('one')
    expect(other.diffRequirements).toHaveLength(1)
  })

  it('⑤ draft 열기 — 새 코멘트를 쓰기 시작하면 이전 활성이 풀린다 (D51)', () => {
    expect(
      chatReducer(selected(), { type: 'SET_DIFF_REQUIREMENT_DRAFT', draft }).activeDiffRequirementId
    ).toBeNull()

    // 양성 짝 — draft 를 닫는 것은 활성을 건드리지 않는다.
    expect(
      chatReducer(selected({ diffRequirementDraft: draft }), {
        type: 'SET_DIFF_REQUIREMENT_DRAFT',
        draft: null
      }).activeDiffRequirementId
    ).toBe('one')
  })

  it('⑥ 성공 clear — 전송이 확정되면 목록과 활성이 함께 비워진다', () => {
    const next = chatReducer(selected(), {
      type: 'CLEAR_DIFF_REQUIREMENTS_IF_UNCHANGED',
      sessionId: 's',
      ids: ['one', 'two'],
      revision: 3
    })

    expect(next.activeDiffRequirementId).toBeNull()
    expect(next.diffRequirements).toEqual([])
  })

  it('⑦ 백엔드가 알린 cwd 변경 — 다른 저장소의 선택을 물려주지 않는다', () => {
    const next = chatReducer(selected(), {
      type: 'RECV_EVENT',
      event: { type: 'session.updated', sessionId: 's', patch: { cwd: '/other' } }
    })

    expect(next.activeDiffRequirementId).toBeNull()
    expect(next.diffRequirements).toEqual([])

    // 양성 짝 — 같은 경로를 다시 알려도 선택은 살아 있다.
    expect(
      chatReducer(selected(), {
        type: 'RECV_EVENT',
        event: { type: 'session.updated', sessionId: 's', patch: { cwd: '/repo' } }
      }).activeDiffRequirementId
    ).toBe('one')
  })

  it('⑧ 사용자가 작업 경로를 바꿈 — 같은 초기화가 이 자리에도 걸린다', () => {
    const next = chatReducer(selected(), { type: 'SET_CWD', cwd: '/other' })

    expect(next.activeDiffRequirementId).toBeNull()
    expect(next.diffRequirements).toEqual([])
  })

  it('선택 자체는 살아 있다 — 여덟 자리를 전부 `null` 로 만든 구현이면 여기서 갈린다', () => {
    const picked = chatReducer(selected({ activeDiffRequirementId: null }), {
      type: 'SELECT_DIFF_REQUIREMENT',
      id: 'two'
    })
    expect(picked.activeDiffRequirementId).toBe('two')

    const added = chatReducer(selected(), {
      type: 'ADD_DIFF_REQUIREMENT',
      item: item('three')
    })
    expect(added.activeDiffRequirementId).toBe('three')
  })
})
