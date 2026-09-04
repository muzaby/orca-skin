// git IPC 5종 — 컴포저 브랜치 칩의 상태 조회·브랜치 목록·전환 + 변경사항 타일의 읽기 2종(0211).
//
// 읽기 둘은 **무해 폴백**이다: git 이 없거나 저장소가 아니어도 컴포저는 그대로 떠야 하고,
// 그 판정(`isRepo:false`)이 곧 "칩을 그리지 않는다" 는 UI 입력이다. 전환만 'reject' 로 두어
// 잘못된 페이로드를 표면화한다 — 실패 자체(더티 트리·충돌)는 예외가 아니라 결과 값으로 온다.

import {
  CHANNELS,
  GitCheckoutRequestSchema,
  GitDiffPatchRequestSchema,
  GitDiffRequestSchema,
  GitPathRequestSchema,
  type GitBranchList,
  type GitCheckoutResult,
  type GitDiffPatch,
  type GitDiffSummary,
  type GitStatus
} from '../../../shared/protocol'
import { gitBranches, gitCheckout, gitStatus } from '../../infra/git/git-cli'
import {
  EMPTY_DIFF_PATCH,
  EMPTY_DIFF_SUMMARY,
  gitDiffPatch,
  gitDiffSummary
} from '../../infra/git/git-diff'
import { handle } from '../../infra/ipc/handle'

// diff 범위의 base 출처 — 세션 출생 때 고정된 baseline 이다. 구조적 포트로 받아
// 핸들러가 `DbQueries` 전체를 알지 않게 한다. **필수 인자다**: optional 로 두면 배선을
// 잊었을 때 모든 세션이 조용히 `HEAD` 범위로 떨어져 격리 세션의 diff 가 틀린 답을 준다.
export interface SessionBaselineLookup {
  // 0211 ΔV4 — 커밋과 **그때의 브랜치 이름**을 함께 준다(D-070). 이름은 화면의 유일한 비교
  // 기준 라벨이라 없으면 사용자가 "무엇 대비" 를 읽지 못한다.
  // `bornAt` = 세션 행이 만들어진 시각(epoch ms). `oid` 가 없는 세션의 기준선을 그 시각으로
  // 되짚는 데 쓴다 — 없으면 조회가 질의 시점 HEAD 로 접혀 기준선이 커밋을 따라 움직인다.
  getSessionBaseline(sessionId: string): {
    oid: string | null
    ref: string | null
    bornAt: number | null
  }
}

const NO_BASELINE = { oid: null, ref: null, bornAt: null } as const

const NOT_REPO: GitStatus = {
  isRepo: false,
  branch: null,
  detached: false,
  root: null
}
const NO_BRANCHES: GitBranchList = { current: null, branches: [] }

export function registerGitHandlers(sessions: SessionBaselineLookup): void {
  // `sessionId` → 출생 baseline(커밋 + 브랜치 이름). 값이 없으면 둘 다 null 이고
  // `resolveDiffRange` 가 HEAD 로 접는다.
  const baselineFor = (
    sessionId?: string
  ): { oid: string | null; ref: string | null; bornAt: number | null } =>
    sessionId ? sessions.getSessionBaseline(sessionId) : NO_BASELINE

  handle(
    CHANNELS.gitStatus,
    GitPathRequestSchema,
    { fallback: NOT_REPO },
    (req): Promise<GitStatus> => gitStatus(req.cwd)
  )

  handle(
    CHANNELS.gitBranches,
    GitPathRequestSchema,
    { fallback: NO_BRANCHES },
    (req): Promise<GitBranchList> => gitBranches(req.cwd)
  )

  handle(
    CHANNELS.gitCheckout,
    GitCheckoutRequestSchema,
    'reject',
    (req): Promise<GitCheckoutResult> => gitCheckout(req.cwd, req.branch, req.resolution)
  )

  // 읽기 둘 — 브랜치 칩과 같은 무해 폴백이다. 저장소가 아니거나 git 이 없어도 타일은 떠야
  // 하고, `isRepo:false` 가 곧 "변경 없음이 아니라 볼 것이 없음" 이라는 UI 입력이다.
  handle(
    CHANNELS.gitDiffSummary,
    GitDiffRequestSchema,
    { fallback: EMPTY_DIFF_SUMMARY },
    (req): Promise<GitDiffSummary> => {
      const baseline = baselineFor(req.sessionId)
      return gitDiffSummary({
        cwd: req.cwd,
        baseOid: baseline.oid,
        baseRef: baseline.ref,
        bornAt: baseline.bornAt
      })
    }
  )

  handle(
    CHANNELS.gitDiffPatch,
    GitDiffPatchRequestSchema,
    { fallback: EMPTY_DIFF_PATCH },
    (req): Promise<GitDiffPatch> => {
      const baseline = baselineFor(req.sessionId)
      return gitDiffPatch({
        cwd: req.cwd,
        ...(req.commitSha ? { commitSha: req.commitSha } : {}),
        baseOid: baseline.oid,
        baseRef: baseline.ref,
        bornAt: baseline.bornAt
      })
    }
  )
}
