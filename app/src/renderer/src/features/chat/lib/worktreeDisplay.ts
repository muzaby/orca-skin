// worktree 세션의 표시 이름 파생 (0211) — **순수 함수**. 두 표면이 같은 규칙을 쓴다:
// 상단 작업 경로 버튼과 컴포저 git 행의 저장소 이름.
//
// **이름은 원본, 동작은 실행 경로다**(D-008). 사용자가 고른 것은 폴더인데 실행은 worktree 에서
// 도므로, 이름까지 실행 경로에서 파생하면 "선택한 디렉토리가 바뀌었다" 로 읽힌다. 반대로
// 동작(탐색기 열기·git 조회·diff)까지 원본으로 돌리면 남의 경로를 열게 된다.
//
// **정본은 `managed_worktrees` row 다**(D-007). 여기서 실행 경로를 역산하지 않는다 —
// `git rev-parse --git-common-dir` 로 본 저장소를 되찾을 수는 있지만 그것은 소비자가 정본을
// 우회하는 합성값이다. row 가 없으면(비격리·0210 D-107 폴백 후) 실행 경로가 곧 원본이라
// 폴백 파생이 정답을 준다(D-020).

import { basenameForDisplay } from '../../../../../shared/path-basename'
import type { WorktreeDisplay } from '../../../../../shared/ipc'

/**
 * 작업 경로 버튼에 그릴 이름. `worktree` 가 있으면 사용자가 고른 경로의 마지막 세그먼트,
 * 없으면 실행 경로의 그것.
 *
 * 0210 D-104 의 경로(`<repo>-<hash8>/<브랜치 slug>`)에서 폴백이 주는 값은 **브랜치 slug** 라
 * 사람이 읽을 수는 있어도 사용자가 고른 폴더 이름이 아니다 — 그것이 이 함수가 있는 이유다.
 */
export function cwdDisplayName(
  cwd: string | null,
  worktree: WorktreeDisplay | null | undefined
): string {
  return basenameForDisplay(worktree?.sourceCwd ?? cwd)
}

/**
 * git 행에 그릴 저장소 이름. `worktree` 가 있으면 **원본 저장소 루트**의 마지막 세그먼트다.
 *
 * worktree 안에서 `git rev-parse --show-toplevel` 은 worktree 루트를 주므로 `status.root`
 * 폴백은 저장소 이름이 아니다. 두 값이 다른 것이 정상이고, 그 차이가 이 함수의 존재 이유다.
 */
export function repoDisplayName(
  root: string | null,
  worktree: WorktreeDisplay | null | undefined
): string | null {
  const source = worktree?.repoRoot ?? root
  if (!source) return null
  const segments = source.split(/[\\/]/).filter((seg) => seg.length > 0)
  return segments.length > 0 ? segments[segments.length - 1] : null
}
