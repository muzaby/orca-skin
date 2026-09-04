import type { GitDiffTotals, GitStatus, WorktreeDisplay } from '../../../../../../shared/ipc'
import { repoDisplayName } from '../../lib/worktreeDisplay'

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
      // null은 요약 준비 전이다. 실제 변경 없음은 0/0 합계 객체로 구분한다.
      totals: GitDiffTotals | null
    }

// 저장소 이름은 **git 루트**에서 읽는다 — 작업 경로가 하위 폴더면
// (`~/proj/orca-skin/app`) basename 이 `app` 이라 저장소 이름이 아니다(0206 D-008).
// 구분자는 POSIX·Windows 둘 다 받는다: `--show-toplevel` 은 `/` 로 주지만 값이 어디서
// 오든 이 함수의 계약은 "마지막 세그먼트" 하나다.
// **worktree 세션에서는 그 루트가 원본 저장소가 아니다**(0211) — `--show-toplevel` 이
// worktree 루트를 준다. 그래서 파생은 `repoDisplayName` 이 소유하고 여기서는 그것을 부른다.
export function repoNameFromRoot(root: string | null): string | null {
  return repoDisplayName(root, null)
}

// 행을 그릴지, 그린다면 무엇을 읽을지.
//
// **두 조건이 모두 참일 때만 그린다**(0206 D-002): 세션이 시작됐고(랜딩이 아니고) git
// 저장소다. 저장소가 아니면 자리조차 잡지 않는다 — 누를 것이 없는 버튼을 두지 않는다는
// 0201 D-002 를 같은 이유로 승계한다.
//
// 요약 준비 전에는 저장소·브랜치만 표시하고 변경량 버튼은 숨긴다.
// 준비된 0/0과 구분할 수 있도록 totals의 null을 그대로 전달한다.
export function gitRowView(
  sessionStarted: boolean,
  cwd: string | null,
  status: GitStatus | null,
  // 0211 — 격리 세션의 표시 정본. **저장소 이름만** 이 값을 쓴다: 브랜치는 worktree 실측
  // 그대로여야 한다(D-009 → D-025 승계) — 그것이 이번 세션의 진짜 작업이다.
  worktree: WorktreeDisplay | null = null,
  // 0211 ΔV1 — 변경량은 **diff 요약 합계**다(D-025). `status` 는 더 이상 이 축을 갖지
  // 않는다: 우측 패널과 다른 명령을 쓰면 두 표면의 수가 갈리고, HEAD 대비는 격리 세션에서
  // 커밋된 작업을 세지 못해 `+0 −0` 이 된다.
  totals: GitDiffTotals | null = null,
  // 0211 ΔV6 D-114 — 사용자가 이 행을 닫은 시점의 턴 종료 tick. `null` 이면 안 닫혔다.
  closedAtTick: number | null = null,
  // 지금까지 관측한 턴 종료 수. `closedAtTick` 과 **같을 때만** 숨긴다 — 다음 턴이 끝나
  // tick 이 오르면 판정이 스스로 풀린다(별도 해제 액션을 두지 않는다).
  tick = 0
): GitRowView {
  if (!sessionStarted || !cwd || !status?.isRepo) return { visible: false }
  if (closedAtTick !== null && closedAtTick === tick) return { visible: false }
  return {
    visible: true,
    repo: repoDisplayName(status.root, worktree),
    branch: status.branch,
    detached: status.detached,
    totals
  }
}

// 0211 ΔV6 D-115 — `shouldRefetchGitStatus(prevBusy, nextBusy)` 는 여기서 **사라졌다**.
// 조회 계기의 정본은 `useGitSnapshot` 의 두 함수이고 그 입력은 `busy` 가 아니라 Stop hook 이
// 낸 `turnEndTick` 이다. 옛 규칙을 남겨 두면 다음 구현자가 그것을 다시 배선한다.
