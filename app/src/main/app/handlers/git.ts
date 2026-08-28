// git IPC 3종 — 컴포저 브랜치 칩의 상태 조회·브랜치 목록·전환.
//
// 읽기 둘은 **무해 폴백**이다: git 이 없거나 저장소가 아니어도 컴포저는 그대로 떠야 하고,
// 그 판정(`isRepo:false`)이 곧 "칩을 그리지 않는다" 는 UI 입력이다. 전환만 'reject' 로 두어
// 잘못된 페이로드를 표면화한다 — 실패 자체(더티 트리·충돌)는 예외가 아니라 결과 값으로 온다.

import {
  CHANNELS,
  GitCheckoutRequestSchema,
  GitPathRequestSchema,
  type GitBranchList,
  type GitCheckoutResult,
  type GitStatus
} from '../../../shared/protocol'
import { gitBranches, gitCheckout, gitStatus } from '../../infra/git/git-cli'
import { handle } from '../../infra/ipc/handle'

const NOT_REPO: GitStatus = {
  isRepo: false,
  branch: null,
  detached: false,
  dirty: null,
  root: null
}
const NO_BRANCHES: GitBranchList = { current: null, branches: [] }

export function registerGitHandlers(): void {
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
}
