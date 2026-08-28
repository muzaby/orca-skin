import type { GitStatus } from '../../../../../../shared/ipc'

// 컴포저 git 행의 판정부 — **React 없이 돌아가는 순수 규칙**만 모은다(0201 `branchChipState` 선례).
//
// 세 판정(행을 그릴지 · 저장소 이름을 무엇으로 읽을지 · 언제 다시 조회할지)이 컴포넌트 안에
// 인라인으로 있으면 렌더 하네스 없이는 아무것도 단언할 수 없는데, 셋은 전부 순수하다.

export type GitRowView =
  | { visible: false }
  | {
      visible: true
      // git 루트의 마지막 세그먼트. 루트를 못 받았으면 null — 이름 자리만 비고 나머지는 산다.
      repo: string | null
      branch: string | null
      detached: boolean
      added: number
      removed: number
    }

// 저장소 이름은 **git 루트**에서 읽는다 — 작업 경로가 하위 폴더면
// (`~/proj/orca-skin/app`) basename 이 `app` 이라 저장소 이름이 아니다(0206 D-008).
// 구분자는 POSIX·Windows 둘 다 받는다: `--show-toplevel` 은 `/` 로 주지만 값이 어디서
// 오든 이 함수의 계약은 "마지막 세그먼트" 하나다.
export function repoNameFromRoot(root: string | null): string | null {
  if (!root) return null
  const segments = root.split(/[\\/]/).filter((seg) => seg.length > 0)
  return segments.length > 0 ? segments[segments.length - 1] : null
}

// 행을 그릴지, 그린다면 무엇을 읽을지.
//
// **두 조건이 모두 참일 때만 그린다**(0206 D-002): 세션이 시작됐고(랜딩이 아니고) git
// 저장소다. 저장소가 아니면 자리조차 잡지 않는다 — 누를 것이 없는 버튼을 두지 않는다는
// 0201 D-002 를 같은 이유로 승계한다.
//
// `dirty: null` 은 **커밋 없음과 변경 없음 둘 다**이고, 행은 그 축을 갖지 않으므로 0/0 으로
// 접는다(0206 §10 선택적 필드 의미).
export function gitRowView(
  sessionStarted: boolean,
  cwd: string | null,
  status: GitStatus | null
): GitRowView {
  if (!sessionStarted || !cwd || !status?.isRepo) return { visible: false }
  return {
    visible: true,
    repo: repoNameFromRoot(status.root),
    branch: status.branch,
    detached: status.detached,
    added: status.dirty?.insertions ?? 0,
    removed: status.dirty?.deletions ?? 0
  }
}

// 턴이 끝나는 **전이에서만** 다시 조회한다(0206 D-004).
//
// 에이전트가 도구로 `git init` 하거나 커밋하는 것이 주 시나리오라 턴 경계가 가장 정확하고
// 싸다. 값이 아니라 전이를 보는 이유는 busy=false 인 동안 매 렌더마다 조회하지 않기 위해서다.
export function shouldRefetchGitStatus(prevBusy: boolean, nextBusy: boolean): boolean {
  return prevBusy && !nextBusy
}
