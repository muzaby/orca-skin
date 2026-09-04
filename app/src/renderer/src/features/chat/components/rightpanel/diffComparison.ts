import type { GitDiffPatch, GitDiffPatchFile, GitDiffSummary } from '../../../../../../shared/ipc'

// 비교 범위는 조회 기준이다. 커밋 선택은 첫 부모 → 해당 커밋 패치를 받는다.

// 0211 ΔV5 D-107 — `uncommitted` 는 진입점과 함께 사라졌다(사용자가 첨부 배치를 골랐다).
// `GitDiffSummary.uncommitted` 계약 필드는 남아 있고 renderer 소비처만 0이 된다.
export type DiffComparison = { kind: 'all' } | { kind: 'commit'; sha: string }

export const ALL_CHANGES: DiffComparison = { kind: 'all' }

export function diffComparisonKey(comparison: DiffComparison): string {
  return comparison.kind === 'all' ? 'all' : `commit:${comparison.sha}`
}

/** 현재 비교 범위에서 화면에 그릴 파일 섹션 하나. */
export interface DiffSection {
  path: string
  /** 현재 비교 범위의 파일 본문. */
  patch: GitDiffPatchFile | null
  /** 현재 비교 범위의 변경량. */
  added: number
  removed: number
}

export function diffSections(patch: GitDiffPatch | null): DiffSection[] {
  if (!patch) return []
  return patch.files.map((file) => ({
    path: file.path,
    patch: file,
    added: file.added,
    removed: file.removed
  }))
}

/**
 * 요약이 새로 와서 고른 커밋이 사라졌으면 전체로 접는다 (0211 ΔV4 §5 파생 UX).
 * 없는 커밋을 고른 채로 빈 목록을 보여주면 사용자는 변경이 사라진 것으로 읽는다.
 */
export function reconcileComparison(
  comparison: DiffComparison,
  summary: GitDiffSummary | null
): DiffComparison {
  if (comparison.kind !== 'commit') return comparison
  return summary?.commits.some((commit) => commit.sha === comparison.sha) ? comparison : ALL_CHANGES
}
