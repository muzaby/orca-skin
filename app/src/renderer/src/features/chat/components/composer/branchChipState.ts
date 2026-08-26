// 브랜치 칩의 판정부 — **React 없이 돌아가는 순수 규칙**만 모은다.
//
// 칩 컴포넌트는 이 파일의 함수를 부르는 얇은 껍데기로 둔다. 세 판정(늦은 응답 무시 · 칩을
// 그릴지 · checkout 결과를 어떤 화면 상태로 접을지)이 컴포넌트 안에 인라인으로 있으면
// 렌더 하네스 없이는 아무것도 단언할 수 없는데, 그 셋은 전부 순수하다.

import type {
  GitCheckoutResult,
  GitDirtyResolution,
  GitDirtyStat,
  GitStatus
} from '../../../../../../shared/ipc'
import type { MessageKey } from '../../../../shared/i18n'

// 상태는 **어느 경로의 것인지와 함께** 들고 있는다. 폴더를 빠르게 바꾸면 늦게 도착한 응답이
// 새 경로의 상태를 덮는데, 경로를 같이 저장하면 이 비교 한 줄로 그 값을 버릴 수 있다.
export interface BranchSnapshot {
  cwd: string | null
  status: GitStatus | null
}

export function statusForCwd(cwd: string | null, snapshot: BranchSnapshot): GitStatus | null {
  return snapshot.cwd === cwd ? snapshot.status : null
}

// 칩을 그릴지, 그린다면 라벨을 무엇으로 읽을지. `branch: null` = detached HEAD.
export type BranchChipView = { visible: false } | { visible: true; branch: string | null }

// **git 저장소가 아니면 아무것도 그리지 않는다** — 누를 것이 없는 버튼을 자리만 잡아 두지
// 않는다(D-002). 작업 경로가 없거나 아직 상태를 못 받은 동안도 같다.
export function branchChipView(cwd: string | null, status: GitStatus | null): BranchChipView {
  if (!cwd || !status?.isRepo) return { visible: false }
  return { visible: true, branch: status.branch }
}

export interface DirtyPrompt {
  target: string
  from: string | null
  stat: GitDirtyStat
}

// checkout 결과가 접히는 세 화면 상태. `failed` 는 **조용히 삼켜지지 않는다** — 왜 브랜치가
// 그대로인지 그 자리에서 보여야 한다.
export type CheckoutOutcome =
  | { kind: 'switched' }
  | { kind: 'ask'; prompt: DirtyPrompt }
  | { kind: 'failed'; message: string; applied?: GitDirtyResolution }

export function checkoutOutcome(result: GitCheckoutResult, target: string): CheckoutOutcome {
  if (result.ok) return { kind: 'switched' }
  if (result.reason === 'dirty') {
    return { kind: 'ask', prompt: { target, from: result.from, stat: result.stat } }
  }
  return {
    kind: 'failed',
    message: result.message,
    ...(result.applied ? { applied: result.applied } : {})
  }
}

// 부분 실패 안내 — 해소는 적용됐는데 checkout 이 실패했을 때 **변경이 어디로 갔는지**.
// 세 해소가 서로 다른 곳에 남기므로 문구도 세 개다. `discard` 는 되돌릴 수 없어서 이 문장이
// 없으면 사용자에게는 데이터 유실과 구분되지 않는다.
export const APPLIED_NOTICE_KEY: Record<GitDirtyResolution, MessageKey> = {
  stash: 'chat.composer.branchAppliedStash',
  'commit-wip': 'chat.composer.branchAppliedCommitWip',
  discard: 'chat.composer.branchAppliedDiscard'
}

// 전환 실패 모달의 본문 — **문단 목록을 여기서 조립한다** (D2).
//
// 순서가 계약이다: 적용된 해소 안내가 **먼저**, git 원문이 뒤. `discard` 는 되돌릴 수 없으므로
// "변경이 어디로 갔는가" 가 오류 원문보다 먼저 읽혀야 한다.
//
// 모달이 이 배열을 그대로 map 하게 두는 것이 요점이다 — 조립을 JSX 안에 인라인으로 두면
// 안내 문단을 지워도 죽는 테스트가 없다(r1 verify D2: 문단+import 를 지우고 잔여물 진단 0까지
// 밀었을 때 typecheck 와 렌더러 352케이스가 전건 통과했다).
export type CheckoutErrorLine =
  { kind: 'notice'; messageKey: MessageKey } | { kind: 'detail'; text: string }

export function checkoutErrorLines(
  error: { message: string; applied?: GitDirtyResolution } | null
): CheckoutErrorLine[] {
  if (error == null) return []
  return [
    ...(error.applied
      ? [{ kind: 'notice' as const, messageKey: APPLIED_NOTICE_KEY[error.applied] }]
      : []),
    { kind: 'detail' as const, text: error.message }
  ]
}
