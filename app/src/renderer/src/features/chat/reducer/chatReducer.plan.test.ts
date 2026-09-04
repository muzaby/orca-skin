import { describe, it, expect } from 'vitest'
import {
  DEFAULT_DIFF_VIEW,
  PANEL_DEFAULT_WIDTH,
  chatReducer,
  initialChatState,
  type ChatState
} from './chatReducer'
import type {
  DiffRequirementItem,
  GitDiffPatch,
  GitDiffSummary,
  NormalizedEvent,
  PlanReviewRequest
} from '../../../../../shared/ipc'

const REVIEW: PlanReviewRequest = { requestId: 'p1', plan: '# 계획\n- b.py 생성' }

const DIFF_SUMMARY: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'head', oid: 'head-oid' },
  files: [{ path: 'src/a.ts', status: 'modified', added: 3, removed: 1, binary: false }],
  totals: { added: 0, removed: 0 },
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
}

const DIFF_PATCH: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid', ref: 'main' },
  files: [
    {
      path: 'src/a.ts',
      status: 'modified',
      added: 1,
      removed: 0,
      kind: 'text',
      lines: [{ type: 'added', oldLine: null, newLine: 1, text: 'x' }]
    }
  ],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

const requirement = (id: string, filePath = 'src/a.ts'): DiffRequirementItem => ({
  id,
  located: true,
  anchor: {
    sessionId: 'session-a',
    baselineCommit: 'base-oid',
    filePath,
    oldLine: null,
    newLine: 2,
    hunkHeader: '@@ -1,2 +1,3 @@',
    contextBefore: ['before'],
    contextAfter: ['after'],
    comment: `comment ${id}`,
    createdAt: 10
  }
})

// 열 id 는 비결정적이라 우측 패널 비교는 tiles 만 본다.
const colTiles = (s: ChatState): string[][] => s.rightPanelTiles.map((c) => c.tiles)

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

// ExitPlanMode 는 permission.requested(action.kind='plan_review')로 도착한다(B2).
const planEvent = (): NormalizedEvent => ({
  type: 'permission.requested',
  approvalId: REVIEW.requestId,
  origin: 'agent',
  action: { kind: 'plan_review', request: REVIEW }
})

describe('chatReducer — 계획 검토(plan_review)', () => {
  it('기본값은 null', () => {
    expect(initialChatState.pendingPlanReview).toBeNull()
  })

  it('우측 패널 타일 기본값', () => {
    expect(initialChatState.rightPanelTiles).toEqual([])
    expect(initialChatState.rightPanelTileLabels).toEqual({})
    expect(initialChatState.planContent).toBeNull()
    expect(initialChatState.rightPanelColWidths).toEqual([])
    expect(PANEL_DEFAULT_WIDTH).toBe(360)
  })

  it('plan_review 이벤트가 pendingPlanReview + planContent 설정 + 계획 타일 자동 활성화', () => {
    const s = chatReducer(initialChatState, recv(planEvent()))
    expect(s.pendingPlanReview).toEqual(REVIEW)
    expect(s.planContent).toBe(REVIEW.plan)
    expect(colTiles(s)).toEqual([['plan']])
  })

  it('RESOLVE_PLAN 은 게이트만 닫고 타일 내용/활성 상태는 유지(읽기전용)', () => {
    const withPlan = chatReducer(initialChatState, recv(planEvent()))
    const cleared = chatReducer(withPlan, { type: 'RESOLVE_PLAN' })
    expect(cleared.pendingPlanReview).toBeNull()
    expect(cleared.planContent).toBe(REVIEW.plan)
    expect(colTiles(cleared)).toEqual([['plan']])
  })

  it('우측 패널 타일 toggle/set active 가 중복 없이 column-major 로 배치', () => {
    const plan = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' })
    expect(colTiles(plan)).toEqual([['plan']])
    const subagent = chatReducer(plan, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'subagent',
      active: true
    })
    expect(colTiles(subagent)).toEqual([['plan', 'subagent']])
    const duplicate = chatReducer(subagent, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'plan',
      active: true
    })
    expect(colTiles(duplicate)).toEqual([['plan', 'subagent']])
    const closed = chatReducer(duplicate, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'plan',
      active: false
    })
    expect(colTiles(closed)).toEqual([['subagent']])
  })

  it('0열 하단 타일 제거 시 다른 열로 리플로우되지 않는다(사용자 사례)', () => {
    // 0열[plan,subagent] / 1열[diff] 구성
    let s = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' })
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'subagent', active: true })
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'diff', active: true })
    expect(colTiles(s)).toEqual([['plan', 'subagent'], ['diff']])
    // 0열 2행(subagent) 제거 → 0열[plan] / 1열[diff] (diff 이 0열로 합쳐지지 않음)
    const removed = chatReducer(s, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'subagent' })
    expect(colTiles(removed)).toEqual([['plan'], ['diff']])
    // 우측 열(diff) id 보존 → React remount 없음
    expect(removed.rightPanelTiles[1].id).toBe(s.rightPanelTiles[1].id)
  })

  it('열이 비면 열 인덱스 키 폭/행분할도 splice 된다', () => {
    // 0열[plan] / 1열[subagent], 각 열 폭 설정
    let s = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' })
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'subagent', active: true })
    // subagent 를 1열로 분리: 0열을 꽉 채우지 않았으므로 toggle 로 두 번째 열 만들기 위해 diff 추가 후 정리
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'diff', active: true })
    // 상태: 0열[plan,subagent] / 1열[diff]
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 0, width: 300 })
    s = chatReducer(s, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 1, width: 500 })
    expect(s.rightPanelColWidths).toEqual([300, 500])
    // 1열의 유일 타일(diff) 제거 → 1열 드롭, 폭 인덱스1도 제거
    const removed = chatReducer(s, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'diff' })
    expect(colTiles(removed)).toEqual([['plan', 'subagent']])
    expect(removed.rightPanelColWidths).toEqual([300])
  })

  it('이름 변경/삭제가 라벨 오버라이드와 활성 목록을 갱신', () => {
    const active = chatReducer(initialChatState, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'diff',
      active: true
    })
    const renamed = chatReducer(active, {
      type: 'RENAME_RIGHT_PANEL_TILE',
      id: 'diff',
      label: '메모'
    })
    expect(renamed.rightPanelTileLabels.diff).toBe('메모')
    const removed = chatReducer(renamed, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'diff' })
    expect(removed.rightPanelTiles).toEqual([])
    expect(removed.rightPanelTileLabels.diff).toBeUndefined()
  })

  it('열 폭과 행 분할을 clamp', () => {
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 0, width: 100 })
        .rightPanelColWidths[0]
    ).toBe(280)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 0, width: 999 })
        .rightPanelColWidths[0]
    ).toBe(640)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_COL_WIDTH', col: 0, width: 420 })
        .rightPanelColWidths[0]
    ).toBe(420)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_ROW_SPLIT', col: 0, frac: 0.1 })
        .rightPanelRowSplits[0]
    ).toBe(0.2)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_ROW_SPLIT', col: 0, frac: 0.9 })
        .rightPanelRowSplits[0]
    ).toBe(0.8)
    expect(
      chatReducer(initialChatState, { type: 'SET_RIGHT_PANEL_ROW_SPLIT', col: 0, frac: 0.5 })
        .rightPanelRowSplits[0]
    ).toBe(0.5)
  })

  it('NEW_CHAT 가 계획 타일 상태(내용/활성/레이아웃)를 리셋', () => {
    const dirty = chatReducer(chatReducer(initialChatState, recv(planEvent())), {
      type: 'SET_RIGHT_PANEL_COL_WIDTH',
      col: 0,
      width: 500
    })
    expect(dirty.planContent).toBe(REVIEW.plan)
    const fresh = chatReducer(dirty, { type: 'NEW_CHAT' })
    expect(fresh.rightPanelTiles).toEqual([])
    expect(fresh.planContent).toBeNull()
    expect(fresh.rightPanelColWidths).toEqual([])
  })

  it('승인 흐름(RESOLVE_PLAN + SET_PERMISSION_MODE) — 카드 제거 + 모드를 acceptEdits 로 전환', () => {
    // 계획 검토는 plan 모드에서만 도달하는 상태 — 전제를 명시한다(초기값에 기대지 않는다).
    const inPlan = chatReducer(initialChatState, { type: 'SET_PERMISSION_MODE', mode: 'plan' })
    const withPlan = chatReducer(inPlan, recv(planEvent()))
    expect(withPlan.permissionMode).toBe('plan')
    const resolved = chatReducer(withPlan, { type: 'RESOLVE_PLAN' })
    const approved = chatReducer(resolved, { type: 'SET_PERMISSION_MODE', mode: 'accept_edits' })
    expect(approved.pendingPlanReview).toBeNull()
    expect(approved.permissionMode).toBe('accept_edits')
  })

  it('계획 코멘트 추가/편집/삭제 + 활성 선택', () => {
    const withPlan = chatReducer(initialChatState, recv(planEvent()))
    const c = { id: 'c1', quote: 'b.py', start: 5, end: 9, body: '이름 바꿔줘', createdAt: 1 }
    const added = chatReducer(withPlan, { type: 'ADD_PLAN_COMMENT', comment: c })
    expect(added.planComments).toEqual([c])
    // 추가 직후 편집 팝오버 자동 오픈 안 함(activeId=null)
    expect(added.activePlanCommentId).toBeNull()

    const selected = chatReducer(added, { type: 'SET_ACTIVE_PLAN_COMMENT', id: 'c1' })
    expect(selected.activePlanCommentId).toBe('c1')

    const edited = chatReducer(selected, {
      type: 'UPDATE_PLAN_COMMENT',
      id: 'c1',
      body: '삭제해줘'
    })
    expect(edited.planComments[0].body).toBe('삭제해줘')

    const removed = chatReducer(edited, { type: 'REMOVE_PLAN_COMMENT', id: 'c1' })
    expect(removed.planComments).toEqual([])
    // 활성 코멘트가 삭제되면 activeId 도 정리
    expect(removed.activePlanCommentId).toBeNull()
  })

  it('RESOLVE_PLAN / NEW_CHAT 가 계획 코멘트를 비운다', () => {
    const withPlan = chatReducer(initialChatState, recv(planEvent()))
    const c = { id: 'c1', quote: 'b.py', start: 5, end: 9, body: '의견', createdAt: 1 }
    const dirty = chatReducer(chatReducer(withPlan, { type: 'ADD_PLAN_COMMENT', comment: c }), {
      type: 'SET_ACTIVE_PLAN_COMMENT',
      id: 'c1'
    })
    const resolved = chatReducer(dirty, { type: 'RESOLVE_PLAN' })
    expect(resolved.planComments).toEqual([])
    expect(resolved.activePlanCommentId).toBeNull()
    expect(chatReducer(dirty, { type: 'NEW_CHAT' }).planComments).toEqual([])
  })

  it('CANCEL_CHAT / error / NEW_CHAT 가 카드를 비운다', () => {
    const withPlan = chatReducer(initialChatState, recv(planEvent()))
    expect(chatReducer(withPlan, { type: 'CANCEL_CHAT' }).pendingPlanReview).toBeNull()
    expect(chatReducer(withPlan, { type: 'NEW_CHAT' }).pendingPlanReview).toBeNull()
    expect(
      chatReducer(
        withPlan,
        recv({
          type: 'error',
          error: { category: 'schema_validation_error', message: 'x', retryable: false }
        })
      ).pendingPlanReview
    ).toBeNull()
  })
})

// 0213 V1 — 정지가 풀려 `작업` 타일이 **모든 활성화 경로로** 열린다 (AT-02 · AT-03 · AT-07).
//
// 0205 가 차단을 잠근 자리를 그대로 되돌린 것이다(0213 D-010). 세 액션 전부를 본다:
// `addTileColumnMajor` 를 부르는 reducer 지점이 5곳이라(§10 EP-01) 대표 경로 하나만 열려도
// 그 하나의 테스트는 통과한다 — 통로가 실제로 하나인지 본다.
describe('chatReducer — 정지 해제된 타일의 활성화 (0213)', () => {
  it('TOGGLE 이 `작업` 타일을 연다', () => {
    const s = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    expect(colTiles(s)).toEqual([['task']])
  })

  it('TOGGLE 은 다른 타일도 그대로 연다 — 형제 짝', () => {
    const s = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'subagent' })
    expect(colTiles(s)).toEqual([['subagent']])
  })

  it('SET_RIGHT_PANEL_TILE_ACTIVE(true) 도 `작업` 타일을 붙인다', () => {
    const s = chatReducer(initialChatState, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'task',
      active: true
    })
    expect(colTiles(s)).toEqual([['task']])
  })

  it('이미 열려 있는 타일 옆에 붙는다 — 열을 갈아엎지 않는다', () => {
    const plan = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' })
    const after = chatReducer(plan, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    expect(colTiles(after)).toEqual([['plan', 'task']])
  })

  // 음성 짝 — 게이트가 상수 통과로 무너져도 위 넷은 통과한다. 정지 배열을 seam 없이 읽는
  // 게이트라 여기서 직접 만들 수는 없고, 술어 단위(`rightPanelTiles.test.ts`)가 그 방향을
  // 맡는다. 여기서는 **닫는 축**이 여전히 사는지를 본다.
  it('TOGGLE 을 한 번 더 누르면 닫힌다 — 여는 것만 되고 닫히지 않는 회귀를 막는다', () => {
    const opened = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    const closed = chatReducer(opened, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    expect(colTiles(closed)).toEqual([])
  })

  it('계획 자동 활성화도 그대로 열린다 — 다섯째 지점', () => {
    const s = chatReducer(initialChatState, recv(planEvent()))
    expect(colTiles(s)).toEqual([['plan']])
  })
})

// 0206 — diff 타일과 git 스냅샷의 세션 상태.
describe('0206 · diff 타일 토글과 git 스냅샷', () => {
  it('변경량 버튼이 diff 타일을 연다·닫는다 — 왕복 (AT-05)', () => {
    const opened = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'diff' })
    expect(colTiles(opened)).toEqual([['diff']])
    const closed = chatReducer(opened, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'diff' })
    expect(colTiles(closed)).toEqual([])
  })

  it('git 스냅샷은 cwd 와 함께 저장된다 — 늦은 응답을 버리는 근거다 (AT-20)', () => {
    expect(initialChatState.gitStatus).toBeNull()
    const snapshot = {
      cwd: '/repo',
      status: { isRepo: true, branch: 'main', detached: false, dirty: null, root: '/repo' }
    }
    const s = chatReducer(initialChatState, { type: 'SET_GIT_STATUS', snapshot })
    expect(s.gitStatus).toEqual(snapshot)
    // 조회 실패는 값으로 접힌다 — 스냅샷 자체는 남고 status 만 null 이다.
    const failed = chatReducer(s, {
      type: 'SET_GIT_STATUS',
      snapshot: { cwd: '/repo', status: null }
    })
    expect(failed.gitStatus).toEqual({ cwd: '/repo', status: null })
  })

  it('패치·접힘·비교 범위는 타일을 닫고 열어도 살아 있다 (AT-46 · D-094)', () => {
    const request = { key: JSON.stringify(['/repo', null]), generation: 1 }
    let state = chatReducer(initialChatState, { type: 'BEGIN_GIT_SNAPSHOT_QUERY', request })
    state = chatReducer(state, { type: 'TOGGLE_DIFF_FILE_EXPANDED', path: 'src/a.ts' })
    state = chatReducer(state, {
      type: 'SET_DIFF_COMPARISON',
      comparison: { kind: 'commit', sha: 'abc1234' }
    })
    state = chatReducer(state, {
      type: 'RECEIVE_GIT_PATCH',
      comparison: { kind: 'commit', sha: 'abc1234' },
      request,
      patch: DIFF_PATCH
    })
    const tileOpen = chatReducer(state, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'diff' })
    const tileClosed = chatReducer(tileOpen, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'diff' })
    const reopened = chatReducer(tileClosed, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'diff' })

    expect(reopened.gitSnapshot.patch).toBe(DIFF_PATCH)
    expect(reopened.gitSnapshot.expandedFiles).toEqual(['src/a.ts'])
    expect(reopened.gitSnapshot.comparison).toEqual({ kind: 'commit', sha: 'abc1234' })
  })

  it('늦게 도착한 패치는 버린다 — 다른 세대의 본문이 새 화면에 닿지 않는다', () => {
    const stale = { key: JSON.stringify(['/repo', null]), generation: 1 }
    const current = { key: JSON.stringify(['/repo', null]), generation: 2 }
    let state = chatReducer(initialChatState, {
      type: 'BEGIN_GIT_SNAPSHOT_QUERY',
      request: current
    })
    state = chatReducer(state, {
      type: 'RECEIVE_GIT_PATCH',
      comparison: { kind: 'all' },
      request: stale,
      patch: DIFF_PATCH
    })

    expect(state.gitSnapshot.patch).toBeNull()
  })

  it('새 대화와 다른 세션 로드 시작은 이전 요약·패치·범위를 넘기지 않는다', () => {
    const dirty = {
      ...initialChatState,
      sessionId: 'session-a',
      gitSnapshot: {
        summary: DIFF_SUMMARY,
        patch: DIFF_PATCH,
        comparison: { kind: 'commit' as const, sha: 'abc1234' },
        expandedFiles: ['src/a.ts'],
        sidebarVisible: false,
        view: DEFAULT_DIFF_VIEW
      }
    } as ChatState

    expect(chatReducer(dirty, { type: 'NEW_CHAT' }).gitSnapshot).toEqual({
      summary: null,
      patch: null,
      comparison: { kind: 'all' },
      expandedFiles: [],
      sidebarVisible: false,
      view: DEFAULT_DIFF_VIEW
    })
    expect(
      chatReducer(dirty, {
        type: 'START_LOAD_SESSION',
        sessionId: 'session-b',
        title: 'B'
      }).gitSnapshot
    ).toEqual({
      summary: null,
      patch: null,
      comparison: { kind: 'all' },
      expandedFiles: [],
      sidebarVisible: false,
      view: DEFAULT_DIFF_VIEW
    })
  })

  it('cwd identity가 바뀌면 이전 저장소의 요약·패치를 즉시 비운다 — 표시 옵션은 남는다', () => {
    const before = {
      ...initialChatState,
      cwd: '/repo-a',
      gitSnapshot: {
        summary: DIFF_SUMMARY,
        patch: DIFF_PATCH,
        comparison: { kind: 'commit' as const, sha: 'abc1234' },
        expandedFiles: ['src/a.ts'],
        sidebarVisible: true,
        view: { ...DEFAULT_DIFF_VIEW, layout: 'side-by-side' as const }
      },
      gitSnapshotRequest: {
        key: JSON.stringify(['/repo-a', 'session-a']),
        generation: 3
      }
    }

    const moved = chatReducer(before, { type: 'SET_CWD', cwd: '/repo-b' })
    expect(moved.gitSnapshot).toEqual({
      summary: null,
      patch: null,
      patchCache: [],
      error: null,
      comparison: { kind: 'all' },
      expandedFiles: [],
      // 표시 취향은 저장소가 아니라 사용자에게 속한다 — 옮겨도 유지한다.
      sidebarVisible: true,
      view: { ...DEFAULT_DIFF_VIEW, layout: 'side-by-side' }
    })
    expect(moved.gitSnapshotRequest).toBeNull()
  })

  it('펼침·범위·표시 옵션 전환은 요약 request 를 건드리지 않는다', () => {
    const before = {
      ...initialChatState,
      gitSnapshot: {
        summary: DIFF_SUMMARY,
        patch: DIFF_PATCH,
        comparison: { kind: 'all' as const },
        expandedFiles: [],
        sidebarVisible: false,
        view: DEFAULT_DIFF_VIEW
      },
      gitSnapshotRequest: { key: JSON.stringify(['/repo', 'session-a']), generation: 2 }
    }

    let after = chatReducer(before, { type: 'TOGGLE_DIFF_FILE_EXPANDED', path: 'src/a.ts' })
    after = chatReducer(after, {
      type: 'SET_DIFF_COMPARISON',
      comparison: { kind: 'commit', sha: 'abc1234' }
    })
    after = chatReducer(after, { type: 'SET_DIFF_SIDEBAR_VISIBLE', visible: true })
    after = chatReducer(after, { type: 'SET_DIFF_VIEW_OPTION', patch: { wrapLines: false } })

    expect(after.gitSnapshotRequest).toEqual(before.gitSnapshotRequest)
    expect(after.gitSnapshot.summary).toBe(DIFF_SUMMARY)
    expect(after.gitSnapshot.patch).toBeNull()
  })

  // 0211 ΔV4 r2 — §10 EP-34 ② 의 **세대 경계**. r1 검증에서 이 `patch: null` 을 지워도
  // 727케이스가 전건 green 이었다(D3): 명시 새로고침 쪽만 잠겨 있었고, 턴 종료로
  // 새 요약이 오는 경로는 아무도 보지 않았다. 낡은 diff 가 남으면 새로고침의 의미가 사라진다.
  it('늦게 도착한 요약은 먼저 받은 같은 세대 패치를 유지한다', () => {
    const request = { key: JSON.stringify(['/repo', 'session-a']), generation: 3 }
    const before = {
      ...initialChatState,
      gitSnapshot: {
        ...initialChatState.gitSnapshot,
        summary: DIFF_SUMMARY,
        patch: DIFF_PATCH,
        expandedFiles: ['src/a.ts'],
        sidebarVisible: true
      },
      gitSnapshotRequest: request
    }

    const after = chatReducer(before, {
      type: 'RECEIVE_GIT_SNAPSHOT_SUMMARY',
      request,
      summary: DIFF_SUMMARY
    })

    expect(after.gitSnapshot.patch).toBe(DIFF_PATCH)
    // 요약은 들어왔다 — "아무것도 안 받았다" 와 구분된다.
    expect(after.gitSnapshot.summary).toBe(DIFF_SUMMARY)
    // 사용자가 만든 화면 상태는 세대 경계에서 살아남는다 — 폐기 대상은 본문뿐이다.
    expect(after.gitSnapshot.expandedFiles).toEqual(['src/a.ts'])
    expect(after.gitSnapshot.sidebarVisible).toBe(true)
  })

  // 0211 ΔV4 r3 — **세션/저장소가 바뀌는 경계** (r2 검증 D18). 위 케이스가 같은 key 안의
  // 세대 경계를 잠근다면 여기는 key 자체가 바뀌는 자리다: 앞 세션의 diff 를 남긴 채 새 요약을
  // 기다리면 사용자는 **다른 저장소의 변경**을 자기 세션 것으로 읽는다.
  it('key 가 바뀌면 요약과 패치를 함께 버린다 — 앞 세션 diff 가 남지 않는다', () => {
    const before = {
      ...initialChatState,
      gitSnapshot: { ...initialChatState.gitSnapshot, summary: DIFF_SUMMARY, patch: DIFF_PATCH },
      gitSnapshotRequest: { key: JSON.stringify(['/repo-a', 'session-a']), generation: 1 }
    }

    const after = chatReducer(before, {
      type: 'BEGIN_GIT_SNAPSHOT_QUERY',
      request: { key: JSON.stringify(['/repo-b', 'session-b']), generation: 1 }
    })

    expect(after.gitSnapshot.summary).toBeNull()
    expect(after.gitSnapshot.patch).toBeNull()
  })

  it('같은 key의 새 세대는 요약을 유지하고 낡은 패치를 즉시 비운다', () => {
    const request = { key: JSON.stringify(['/repo-a', 'session-a']), generation: 1 }
    const before = {
      ...initialChatState,
      gitSnapshot: { ...initialChatState.gitSnapshot, summary: DIFF_SUMMARY, patch: DIFF_PATCH },
      gitSnapshotRequest: request
    }

    const after = chatReducer(before, {
      type: 'BEGIN_GIT_SNAPSHOT_QUERY',
      request: { ...request, generation: 2 }
    })

    expect(after.gitSnapshot.summary).toBe(DIFF_SUMMARY)
    expect(after.gitSnapshot.patch).toBeNull()
  })

  it('같은 key의 늦은 요청 A가 더 최신 요청 B의 요약을 덮지 못한다', () => {
    const key = JSON.stringify(['/repo', 'session-a'])
    const newerSummary = { ...DIFF_SUMMARY, files: [] }
    const request = (generation: number): { key: string; generation: number } => ({
      key,
      generation
    })
    const startedA = chatReducer(initialChatState, {
      type: 'BEGIN_GIT_SNAPSHOT_QUERY',
      request: request(1)
    })
    const startedB = chatReducer(startedA, {
      type: 'BEGIN_GIT_SNAPSHOT_QUERY',
      request: request(2)
    })
    const resolvedB = chatReducer(startedB, {
      type: 'RECEIVE_GIT_SNAPSHOT_SUMMARY',
      request: request(2),
      summary: newerSummary
    })
    const lateA = chatReducer(resolvedB, {
      type: 'RECEIVE_GIT_SNAPSHOT_SUMMARY',
      request: request(1),
      summary: DIFF_SUMMARY
    })

    expect(lateA.gitSnapshot.summary).toBe(newerSummary)
  })
})

describe('0211 ΔV2 · diff 요구사항 세션 상태', () => {
  it('추가와 삭제는 항목과 revision을 같은 reducer 슬라이스에서 갱신한다', () => {
    const added = chatReducer(initialChatState, {
      type: 'ADD_DIFF_REQUIREMENT',
      item: requirement('req-1')
    })
    expect(added.diffRequirements).toEqual([requirement('req-1')])
    expect(added.diffRequirementsRevision).toBe(1)

    const removed = chatReducer(added, { type: 'REMOVE_DIFF_REQUIREMENT', id: 'req-1' })
    expect(removed.diffRequirements).toEqual([])
    expect(removed.diffRequirementsRevision).toBe(2)
  })

  it('패치 재anchor는 세션이 맞을 때만 적용하고 못 찾은 항목은 남긴다 (D-093)', () => {
    const seeded = {
      ...initialChatState,
      sessionId: 'session-a',
      diffRequirements: [requirement('req-1')],
      gitSnapshotRequest: { key: 'k', generation: 1 }
    } as ChatState
    const patch = (texts: string[]): GitDiffPatch => ({
      ...DIFF_PATCH,
      files: [
        {
          path: 'src/a.ts',
          status: 'modified',
          added: texts.length,
          removed: 0,
          kind: 'text',
          lines: texts.map((text, index) => ({
            type: 'added' as const,
            oldLine: null,
            newLine: index + 1,
            text
          }))
        }
      ]
    })

    // 세대가 다른 응답은 통째로 무시된다 — 요구사항도 그대로다.
    const stale = chatReducer(seeded, {
      type: 'RECEIVE_GIT_PATCH',
      comparison: { kind: 'all' },
      request: { key: 'k', generation: 9 },
      patch: patch(['before', 'target', 'after'])
    })
    expect(stale.diffRequirements[0].located).toBe(true)
    expect(stale.diffRequirementsRevision).toBe(0)

    // 줄을 못 찾아도 항목은 남는다 — 위치를 잃은 것과 요구가 없어진 것은 다르다.
    const missing = chatReducer(seeded, {
      type: 'RECEIVE_GIT_PATCH',
      comparison: { kind: 'all' },
      request: { key: 'k', generation: 1 },
      patch: patch(['other before', 'target', 'other after'])
    })
    expect(missing.diffRequirements).toEqual([{ ...requirement('req-1'), located: false }])
    expect(missing.diffRequirementsRevision).toBe(1)
  })

  it('성공 전송 clear는 제출 ids와 revision이 그대로일 때만 비운다', () => {
    const seeded = {
      ...initialChatState,
      sessionId: 'session-a',
      diffRequirements: [requirement('req-1'), requirement('req-2')],
      diffRequirementsRevision: 2
    } as ChatState
    const unchanged = chatReducer(seeded, {
      type: 'CLEAR_DIFF_REQUIREMENTS_IF_UNCHANGED',
      sessionId: 'session-a',
      ids: ['req-1', 'req-2'],
      revision: 2
    })
    expect(unchanged.diffRequirements).toEqual([])
    expect(unchanged.diffRequirementsRevision).toBe(3)

    const editedInFlight = chatReducer(seeded, { type: 'REMOVE_DIFF_REQUIREMENT', id: 'req-2' })
    const lateClear = chatReducer(editedInFlight, {
      type: 'CLEAR_DIFF_REQUIREMENTS_IF_UNCHANGED',
      sessionId: 'session-a',
      ids: ['req-1', 'req-2'],
      revision: 2
    })
    expect(lateClear.diffRequirements.map((item) => item.id)).toEqual(['req-1'])
    expect(lateClear.diffRequirementsRevision).toBe(3)
  })

  it('작성 중 diff 요구사항 draft 편집도 revision을 올려 오래된 전송 clear를 막는다', () => {
    const seeded = {
      ...initialChatState,
      sessionId: 'session-a',
      diffRequirements: [requirement('req-1')]
    } as ChatState
    const withDraft = chatReducer(seeded, {
      type: 'SET_DIFF_REQUIREMENT_DRAFT',
      draft: {
        key: 'src/a.ts:null:2',
        filePath: 'src/a.ts',
        oldLine: null,
        newLine: 2,
        body: 'draft'
      }
    })
    expect(withDraft.diffRequirementsRevision).toBe(1)

    const lateClear = chatReducer(withDraft, {
      type: 'CLEAR_DIFF_REQUIREMENTS_IF_UNCHANGED',
      sessionId: 'session-a',
      ids: ['req-1'],
      revision: 0
    })
    expect(lateClear.diffRequirements.map((item) => item.id)).toEqual(['req-1'])
    expect(lateClear.diffRequirementDraft?.body).toBe('draft')
  })

  it('새 채팅·세션 로드 시작·cwd 변경은 요구사항과 작성 중 draft를 다른 identity로 넘기지 않는다', () => {
    const dirty = {
      ...initialChatState,
      cwd: '/repo-a',
      sessionId: 'session-a',
      diffRequirements: [requirement('req-1')],
      diffRequirementsRevision: 1,
      diffRequirementDraft: {
        key: 'src/a.ts:null:2',
        filePath: 'src/a.ts',
        oldLine: null,
        newLine: 2,
        body: 'draft'
      }
    } as ChatState

    expect(chatReducer(dirty, { type: 'NEW_CHAT' }).diffRequirements).toEqual([])
    expect(
      chatReducer(dirty, { type: 'START_LOAD_SESSION', sessionId: 'session-b', title: 'B' })
        .diffRequirementDraft
    ).toBeNull()
    expect(chatReducer(dirty, { type: 'SET_CWD', cwd: '/repo-b' }).diffRequirements).toEqual([])
  })
})

describe('0211 ΔV4 · 패치 도착 시점의 요구사항 재anchor (AT-54 · D-093)', () => {
  const anchorItem = (filePath: string, comment: string): DiffRequirementItem => ({
    id: `req-${filePath}`,
    located: true,
    anchor: {
      sessionId: 's1',
      baselineCommit: 'b'.repeat(40),
      filePath,
      oldLine: null,
      newLine: 1,
      hunkHeader: `${filePath}:1`,
      contextBefore: [],
      contextAfter: [],
      comment,
      createdAt: 1
    }
  })

  const patchWith = (files: GitDiffPatch['files']): GitDiffPatch => ({
    isRepo: true,
    base: { kind: 'worktree-base', oid: 'b'.repeat(40), ref: 'main' },
    files,
    filesTruncated: false,
    contextLimited: false,
    unavailable: false
  })

  const textFile = (path: string, texts: string[]): GitDiffPatch['files'][number] => ({
    path,
    status: 'modified',
    added: texts.length,
    removed: 0,
    kind: 'text',
    lines: texts.map((text, index) => ({
      type: 'added' as const,
      oldLine: null,
      newLine: index + 1,
      text
    }))
  })

  const seeded = (items: DiffRequirementItem[]): ChatState => ({
    ...initialChatState,
    cwd: '/repo',
    sessionId: 's1',
    diffRequirements: items,
    gitSnapshotRequest: { key: 'k', generation: 1 }
  })

  it('파일 경계를 지킨다 — A 의 anchor 를 B 의 줄에 붙이지 않는다', () => {
    const state = seeded([anchorItem('a.ts', 'A 요구'), anchorItem('b.ts', 'B 요구')])
    const next = chatReducer(state, {
      type: 'RECEIVE_GIT_PATCH',
      comparison: { kind: 'all' },
      request: { key: 'k', generation: 1 },
      patch: patchWith([textFile('a.ts', ['moved']), textFile('b.ts', ['other'])])
    })

    expect(next.diffRequirements.map((item) => item.anchor.filePath)).toEqual(['a.ts', 'b.ts'])
    expect(next.diffRequirements.map((item) => item.anchor.comment)).toEqual(['A 요구', 'B 요구'])
  })

  it('패치에 없는 파일의 요구사항은 located:false 로 남는다 — 문장이 사라지지 않는다', () => {
    const state = seeded([anchorItem('gone.ts', '사라진 파일의 요구')])
    const next = chatReducer(state, {
      type: 'RECEIVE_GIT_PATCH',
      comparison: { kind: 'all' },
      request: { key: 'k', generation: 1 },
      patch: patchWith([textFile('a.ts', ['x'])])
    })

    expect(next.diffRequirements).toHaveLength(1)
    expect(next.diffRequirements[0].located).toBe(false)
    expect(next.diffRequirements[0].anchor.comment).toBe('사라진 파일의 요구')
  })
})
