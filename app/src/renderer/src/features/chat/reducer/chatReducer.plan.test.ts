import { describe, it, expect } from 'vitest'
import {
  PANEL_DEFAULT_WIDTH,
  chatReducer,
  initialChatState,
  type ChatState,
  type GitPeekTarget
} from './chatReducer'
import type {
  DiffRequirementItem,
  GitDiffFileContent,
  GitDiffSummary,
  NormalizedEvent,
  PlanReviewRequest
} from '../../../../../shared/ipc'
import type { DiffLine } from '../lib/diffLines'
import { getDiffBody } from '../components/rightpanel/diffBodyCache'
import { diffPeekBodyKey } from '../components/rightpanel/diffFileCache'

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

const diffLine = (
  type: DiffLine['type'],
  oldLine: number | null,
  newLine: number | null,
  text: string
): DiffLine => ({
  type,
  oldLine,
  newLine,
  lineNo: type === 'removed' ? (oldLine ?? 0) : (newLine ?? 0),
  text
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

// 0205 V1 — 정지된 타일은 어느 활성화 경로로도 열리지 않는다 (AT-02 · AT-03).
//
// 세 액션 전부를 본다. `addTileColumnMajor` 를 부르는 reducer 지점이 5곳이라(§10 EP-01)
// 대표 경로 하나만 막아도 그 하나의 테스트는 통과한다 — 통로가 실제로 하나인지 본다.
describe('chatReducer — 정지된 타일의 활성화 차단 (0205)', () => {
  it('TOGGLE 은 정지된 타일을 열지 않는다 — 상태 참조가 그대로다', () => {
    const s = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    expect(colTiles(s)).toEqual([])
    expect(s.rightPanelTiles).toBe(initialChatState.rightPanelTiles)
  })

  it('TOGGLE 은 정지되지 않은 타일을 연다 — 양성 짝', () => {
    const s = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'subagent' })
    expect(colTiles(s)).toEqual([['subagent']])
  })

  it('SET_RIGHT_PANEL_TILE_ACTIVE(true) 도 정지된 타일을 붙이지 않는다', () => {
    const s = chatReducer(initialChatState, {
      type: 'SET_RIGHT_PANEL_TILE_ACTIVE',
      id: 'task',
      active: true
    })
    expect(colTiles(s)).toEqual([])
  })

  it('이미 열려 있는 다른 타일은 정지된 타일 요청에 영향받지 않는다', () => {
    const plan = chatReducer(initialChatState, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' })
    const after = chatReducer(plan, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    expect(colTiles(after)).toEqual([['plan']])
  })

  it('계획 자동 활성화는 정지 대상이 아니라 그대로 열린다 — 다섯째 지점의 양성 짝', () => {
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

  it('peek와 commit 펼침은 타일을 닫고 열어도 살아 있고 Back은 peek만 비운다', () => {
    const target = { group: { kind: 'commit' as const, sha: 'abc1234' }, path: 'src/a.ts' }
    const opened = chatReducer(initialChatState, { type: 'OPEN_GIT_SNAPSHOT_PEEK', target })
    const expanded = chatReducer(opened, {
      type: 'TOGGLE_GIT_SNAPSHOT_COMMIT_EXPANDED',
      sha: 'abc1234'
    })
    const tileOpen = chatReducer(expanded, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'diff' })
    const tileClosed = chatReducer(tileOpen, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'diff' })
    const reopened = chatReducer(tileClosed, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'diff' })
    const back = chatReducer(reopened, { type: 'CLOSE_GIT_SNAPSHOT_PEEK' })

    expect(reopened.gitSnapshot.peekTarget).toEqual(target)
    expect(reopened.gitSnapshot.expandedCommitIds).toEqual(['abc1234'])
    expect(back.gitSnapshot.peekTarget).toBeNull()
    expect(back.gitSnapshot.expandedCommitIds).toEqual(['abc1234'])
  })

  it('새 대화와 다른 세션 로드 시작은 이전 요약·peek·펼침을 넘기지 않는다', () => {
    const dirty = {
      ...initialChatState,
      sessionId: 'session-a',
      gitSnapshot: {
        summary: DIFF_SUMMARY,
        peekTarget: { group: { kind: 'commit' as const, sha: 'abc1234' }, path: 'src/a.ts' },
        expandedCommitIds: ['abc1234'],
        refreshGeneration: 2,
        bodyCache: []
      }
    } as ChatState

    expect(chatReducer(dirty, { type: 'NEW_CHAT' }).gitSnapshot).toEqual({
      summary: null,
      peekTarget: null,
      expandedCommitIds: [],
      refreshGeneration: 0,
      bodyCache: []
    })
    expect(
      chatReducer(dirty, {
        type: 'START_LOAD_SESSION',
        sessionId: 'session-b',
        title: 'B'
      }).gitSnapshot
    ).toEqual({
      summary: null,
      peekTarget: null,
      expandedCommitIds: [],
      refreshGeneration: 0,
      bodyCache: []
    })
  })

  it('cwd identity가 바뀌면 이전 저장소의 요약·peek·펼침을 즉시 비운다', () => {
    const before = {
      ...initialChatState,
      cwd: '/repo-a',
      gitSnapshot: {
        summary: DIFF_SUMMARY,
        peekTarget: { group: { kind: 'commit' as const, sha: 'abc1234' }, path: 'src/a.ts' },
        expandedCommitIds: ['abc1234'],
        refreshGeneration: 0,
        bodyCache: []
      },
      gitSnapshotRequest: {
        key: JSON.stringify(['/repo-a', 'session-a']),
        generation: 3
      }
    }

    const moved = chatReducer(before, { type: 'SET_CWD', cwd: '/repo-b' })
    expect(moved.gitSnapshot).toEqual({
      summary: null,
      peekTarget: null,
      expandedCommitIds: [],
      refreshGeneration: 0,
      bodyCache: []
    })
    expect(moved.gitSnapshotRequest).toBeNull()
  })

  it('명시 refresh는 요약·peek·펼침을 보존하고 generation만 올린다', () => {
    const before = {
      ...initialChatState,
      gitSnapshot: {
        summary: DIFF_SUMMARY,
        peekTarget: { group: { kind: 'uncommitted' as const }, path: 'src/a.ts' },
        expandedCommitIds: ['abc1234'],
        refreshGeneration: 4,
        bodyCache: []
      }
    }
    const refreshed = chatReducer(before, { type: 'REFRESH_GIT_SNAPSHOT' })

    expect(refreshed.gitSnapshot).toEqual({
      summary: DIFF_SUMMARY,
      peekTarget: { group: { kind: 'uncommitted' }, path: 'src/a.ts' },
      expandedCommitIds: ['abc1234'],
      refreshGeneration: 5,
      bodyCache: []
    })
  })

  it('peek open/back과 commit 펼침은 요약 request·refresh generation을 건드리지 않는다', () => {
    const before = {
      ...initialChatState,
      gitSnapshot: {
        summary: DIFF_SUMMARY,
        peekTarget: null,
        expandedCommitIds: [],
        refreshGeneration: 4,
        bodyCache: []
      },
      gitSnapshotRequest: { key: JSON.stringify(['/repo', 'session-a']), generation: 2 }
    }

    const peeked = chatReducer(before, {
      type: 'OPEN_GIT_SNAPSHOT_PEEK',
      target: { group: { kind: 'commit', sha: 'abc1234' }, path: 'src/a.ts' }
    })
    const expanded = chatReducer(peeked, {
      type: 'TOGGLE_GIT_SNAPSHOT_COMMIT_EXPANDED',
      sha: 'abc1234'
    })
    const backed = chatReducer(expanded, { type: 'CLOSE_GIT_SNAPSHOT_PEEK' })

    expect(backed.gitSnapshotRequest).toEqual(before.gitSnapshotRequest)
    expect(backed.gitSnapshot.refreshGeneration).toBe(4)
    expect(backed.gitSnapshot.summary).toBe(DIFF_SUMMARY)
  })

  it('refresh 신호 뒤 새 요청 시작 전 도착한 이전 응답도 무시한다', () => {
    const request = { key: JSON.stringify(['/repo', 'session-a']), generation: 1 }
    const started = chatReducer(initialChatState, {
      type: 'BEGIN_GIT_SNAPSHOT_QUERY',
      request
    })
    const refreshed = chatReducer(started, { type: 'REFRESH_GIT_SNAPSHOT' })
    const late = chatReducer(refreshed, {
      type: 'RECEIVE_GIT_SNAPSHOT_SUMMARY',
      request,
      summary: DIFF_SUMMARY
    })

    expect(late.gitSnapshot.summary).toBeNull()
    expect(late.gitSnapshotRequest?.generation).toBe(2)
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

  it('peek 본문 재anchor는 세션과 path가 맞을 때만 적용하고 못 찾은 항목은 남긴다', () => {
    const seeded = {
      ...initialChatState,
      sessionId: 'session-a',
      diffRequirements: [requirement('req-1')],
      diffRequirementBodyRequest: {
        sessionId: 'session-a',
        path: 'src/a.ts',
        key: 'body-key',
        generation: 7
      }
    } as ChatState
    const staleSession = chatReducer(seeded, {
      type: 'REANCHOR_DIFF_REQUIREMENTS',
      sessionId: 'session-b',
      path: 'src/a.ts',
      request: { key: 'body-key', generation: 7 },
      lines: [
        diffLine('unchanged', 1, 1, 'before'),
        diffLine('added', null, 2, 'target'),
        diffLine('unchanged', 2, 3, 'after')
      ]
    })
    expect(staleSession.diffRequirements[0].located).toBe(true)
    expect(staleSession.diffRequirementsRevision).toBe(0)

    const missing = chatReducer(seeded, {
      type: 'REANCHOR_DIFF_REQUIREMENTS',
      sessionId: 'session-a',
      path: 'src/a.ts',
      request: { key: 'body-key', generation: 7 },
      lines: [
        diffLine('unchanged', 1, 1, 'other before'),
        diffLine('added', null, 2, 'target'),
        diffLine('unchanged', 2, 3, 'other after')
      ]
    })
    expect(missing.diffRequirements).toEqual([{ ...requirement('req-1'), located: false }])
    expect(missing.diffRequirementsRevision).toBe(1)
  })

  it('peek 본문 재anchor는 등록된 body key/generation과 맞아야 적용된다', () => {
    const registered = chatReducer(
      {
        ...initialChatState,
        sessionId: 'session-a',
        diffRequirements: [requirement('req-1')]
      } as ChatState,
      {
        type: 'SET_DIFF_REQUIREMENT_BODY_REQUEST',
        sessionId: 'session-a',
        path: 'src/a.ts',
        request: { key: 'body-key', generation: 7 }
      }
    )

    const staleBody = chatReducer(registered, {
      type: 'REANCHOR_DIFF_REQUIREMENTS',
      sessionId: 'session-a',
      path: 'src/a.ts',
      request: { key: 'body-key', generation: 6 },
      lines: [
        diffLine('unchanged', 1, 1, 'other before'),
        diffLine('added', null, 2, 'target'),
        diffLine('unchanged', 2, 3, 'other after')
      ]
    })
    expect(staleBody.diffRequirements[0].located).toBe(true)
    expect(staleBody.diffRequirementsRevision).toBe(0)

    const currentBody = chatReducer(registered, {
      type: 'REANCHOR_DIFF_REQUIREMENTS',
      sessionId: 'session-a',
      path: 'src/a.ts',
      request: { key: 'body-key', generation: 7 },
      lines: [
        diffLine('unchanged', 1, 1, 'other before'),
        diffLine('added', null, 2, 'target'),
        diffLine('unchanged', 2, 3, 'other after')
      ]
    })
    expect(currentBody.diffRequirements[0].located).toBe(false)
    expect(currentBody.diffRequirementsRevision).toBe(1)
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

describe('0211 ΔV3 · diff 본문 캐시 수명 (AT-38 · AT-42 · EP-24)', () => {
  const target = (path: string): GitPeekTarget => ({
    group: { kind: 'commit', sha: 'c1' },
    path
  })
  const text = (v: string): GitDiffFileContent => ({
    kind: 'text',
    oldValue: '',
    newValue: v,
    truncated: false
  })
  const seeded = (): ChatState => ({
    ...initialChatState,
    cwd: '/repo',
    sessionId: 's1'
  })
  const keyOf = (state: ChatState, path: string): string =>
    diffPeekBodyKey(
      state.cwd,
      state.sessionId,
      target(path),
      state.gitSnapshotRequest?.generation ?? 0
    )

  it('A→B→A 왕복에서 두 파일 모두 캐시에 남아 세 번째 진입은 조회가 필요 없다', () => {
    let state = seeded()
    for (const path of ['a.ts', 'b.ts']) {
      state = chatReducer(state, { type: 'OPEN_GIT_SNAPSHOT_PEEK', target: target(path) })
      // 조회 응답이 캐시에 남는다.
      state = chatReducer(state, {
        type: 'RECORD_DIFF_BODY',
        key: keyOf(state, path),
        content: text(path)
      })
    }
    state = chatReducer(state, { type: 'OPEN_GIT_SNAPSHOT_PEEK', target: target('a.ts') })

    // 화면의 조회 여부 판정과 **같은 함수**로 센다.
    expect(getDiffBody(state.gitSnapshot.bodyCache, keyOf(state, 'a.ts'))).not.toBeNull()
    expect(getDiffBody(state.gitSnapshot.bodyCache, keyOf(state, 'b.ts'))).not.toBeNull()
    // 진입이 사용순을 올렸다 — a.ts 가 가장 최근이다.
    expect(state.gitSnapshot.bodyCache.at(-1)?.key).toBe(keyOf(state, 'a.ts'))
  })

  it('새로고침(요약 세대 증가) 뒤 같은 파일은 캐시를 비껴간다', () => {
    let state = seeded()
    state = chatReducer(state, { type: 'OPEN_GIT_SNAPSHOT_PEEK', target: target('a.ts') })
    const before = keyOf(state, 'a.ts')
    state = chatReducer(state, { type: 'RECORD_DIFF_BODY', key: before, content: text('old') })
    state = chatReducer(state, {
      type: 'BEGIN_GIT_SNAPSHOT_QUERY',
      request: { key: 'k', generation: 7 }
    })

    expect(keyOf(state, 'a.ts')).not.toBe(before)
    expect(getDiffBody(state.gitSnapshot.bodyCache, keyOf(state, 'a.ts'))).toBeNull()
  })

  it('cwd 변경과 새 대화는 이전 저장소의 본문을 넘기지 않는다', () => {
    let state = seeded()
    state = chatReducer(state, { type: 'OPEN_GIT_SNAPSHOT_PEEK', target: target('a.ts') })
    state = chatReducer(state, {
      type: 'RECORD_DIFF_BODY',
      key: keyOf(state, 'a.ts'),
      content: text('secret')
    })
    expect(state.gitSnapshot.bodyCache).toHaveLength(1)

    expect(chatReducer(state, { type: 'SET_CWD', cwd: '/other' }).gitSnapshot.bodyCache).toEqual([])
    expect(chatReducer(state, { type: 'NEW_CHAT' }).gitSnapshot.bodyCache).toEqual([])
    expect(
      chatReducer(state, { type: 'START_LOAD_SESSION', sessionId: 's2', title: null }).gitSnapshot
        .bodyCache
    ).toEqual([])
  })
})
