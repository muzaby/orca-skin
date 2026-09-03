import type { GitDiffPatch, GitDiffPatchFile, GitDiffSummary } from '../../../../../../shared/ipc'

// 비교 범위 필터 (0211 ΔV4 D-079·D-080).
//
// **목록만 좁힌다.** 커밋을 골라도 각 파일의 diff 기준은 세션 기준선 → 현재 그대로다 — 사용자가
// 그렇게 골랐고(질의 응답 §커밋 모드), 그래서 `GitDiffPatchRequest` 에 커밋 인자가 없다(D-036).
// 모드 전환은 조회가 아니라 **이미 받은 패치에 대한 순수 파생**이다.

// 0211 ΔV5 D-107 — `uncommitted` 는 진입점과 함께 사라졌다(사용자가 첨부 배치를 골랐다).
// `GitDiffSummary.uncommitted` 계약 필드는 남아 있고 renderer 소비처만 0이 된다.
export type DiffComparison = { kind: 'all' } | { kind: 'commit'; sha: string }

export const ALL_CHANGES: DiffComparison = { kind: 'all' }

/** 화면에 그릴 파일 섹션 하나. `patch` 가 `null` 이면 그 커밋의 변경이 이후 되돌려진 것이다. */
export interface DiffSection {
  path: string
  /** 세션 diff 안의 그 파일. 범위에는 있는데 세션 기준으로 변화가 없으면 `null`. */
  patch: GitDiffPatchFile | null
  /** 헤더에 그릴 변경량 — `patch` 가 없으면 그 범위(커밋/미커밋)가 준 값이다. */
  added: number
  removed: number
}

function sectionsFrom(
  paths: readonly { path: string; added: number; removed: number }[],
  byPath: ReadonlyMap<string, GitDiffPatchFile>
): DiffSection[] {
  const seen = new Set<string>()
  const sections: DiffSection[] = []
  for (const entry of paths) {
    if (seen.has(entry.path)) continue
    seen.add(entry.path)
    const patch = byPath.get(entry.path) ?? null
    sections.push({
      path: entry.path,
      patch,
      added: patch?.added ?? entry.added,
      removed: patch?.removed ?? entry.removed
    })
  }
  return sections
}

export function diffSections(
  patch: GitDiffPatch | null,
  summary: GitDiffSummary | null,
  comparison: DiffComparison
): DiffSection[] {
  if (!patch) return []
  const byPath = new Map(patch.files.map((file) => [file.path, file]))
  if (comparison.kind === 'all')
    return patch.files.map((file) => ({
      path: file.path,
      patch: file,
      added: file.added,
      removed: file.removed
    }))
  const commit = summary?.commits.find((entry) => entry.sha === comparison.sha)
  return sectionsFrom(commit?.files ?? [], byPath)
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
