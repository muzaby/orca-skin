// git IPC 5종 — 컴포저 브랜치 칩의 상태 조회·브랜치 목록·전환 + 변경사항 타일의 읽기 2종(0211).
//
// 읽기 둘은 **무해 폴백**이다: git 이 없거나 저장소가 아니어도 컴포저는 그대로 떠야 하고,
// 그 판정(`isRepo:false`)이 곧 "칩을 그리지 않는다" 는 UI 입력이다. 전환만 'reject' 로 두어
// 잘못된 페이로드를 표면화한다 — 실패 자체(더티 트리·충돌)는 예외가 아니라 결과 값으로 온다.

import {
  CHANNELS,
  GitCheckoutRequestSchema,
  GitDiffFileRequestSchema,
  GitDiffRequestSchema,
  GitPathRequestSchema,
  type GitBranchList,
  type GitCheckoutResult,
  type GitDiffFileContent,
  type GitDiffSummary,
  type GitStatus
} from '../../../shared/protocol'
import { gitBranches, gitCheckout, gitStatus } from '../../infra/git/git-cli'
import { EMPTY_DIFF_SUMMARY, gitDiffFile, gitDiffSummary } from '../../infra/git/git-diff'
import { handle } from '../../infra/ipc/handle'

// diff 범위의 base 출처 — 세션 출생 때 고정된 baseline 이다. 구조적 포트로 받아
// 핸들러가 `DbQueries` 전체를 알지 않게 한다. **필수 인자다**: optional 로 두면 배선을
// 잊었을 때 모든 세션이 조용히 `HEAD` 범위로 떨어져 격리 세션의 diff 가 틀린 답을 준다.
export interface SessionBaselineLookup {
  getSessionBaseline(sessionId: string): string | null
}

const UNAVAILABLE_DIFF_FILE: GitDiffFileContent = { kind: 'unavailable', reason: 'error' }

const NOT_REPO: GitStatus = {
  isRepo: false,
  branch: null,
  detached: false,
  root: null
}
const NO_BRANCHES: GitBranchList = { current: null, branches: [] }

export function registerGitHandlers(sessions: SessionBaselineLookup): void {
  // `sessionId` → 출생 baseline. 값이 없으면 null 이고 `resolveDiffRange` 가 HEAD 로 접는다.
  const baseOidFor = (sessionId?: string): string | null =>
    sessionId ? sessions.getSessionBaseline(sessionId) : null

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
    (req): Promise<GitDiffSummary> =>
      gitDiffSummary({
        cwd: req.cwd,
        baseOid: baseOidFor(req.sessionId)
      })
  )

  handle(
    CHANNELS.gitDiffFile,
    GitDiffFileRequestSchema,
    { fallback: UNAVAILABLE_DIFF_FILE },
    (req): Promise<GitDiffFileContent> =>
      gitDiffFile({
        cwd: req.cwd,
        path: req.path,
        baseOid: baseOidFor(req.sessionId)
      })
  )
}
