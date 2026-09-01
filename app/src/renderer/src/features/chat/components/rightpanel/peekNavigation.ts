import type { GitDiffFileEntry, GitDiffSummary } from '../../../../../../shared/ipc'
import type { GitPeekTarget } from '../../reducer/chatReducer'

export interface PeekNavigation {
  index: number
  total: number
  previous: GitPeekTarget | null
  next: GitPeekTarget | null
}

function groupFiles(summary: GitDiffSummary, target: GitPeekTarget): readonly GitDiffFileEntry[] {
  const group = target.group
  if (group.kind === 'uncommitted') return summary.uncommitted.files
  return summary.commits.find((commit) => commit.sha === group.sha)?.files ?? []
}

/** Prev/Next는 들어온 목록 group으로만 제한한다. session-wide body 요청 범위와는 별개다. */
export function peekNavigation(summary: GitDiffSummary, target: GitPeekTarget): PeekNavigation {
  const files = groupFiles(summary, target)
  const current = files.findIndex((file) => file.path === target.path)
  const targetFor = (file: GitDiffFileEntry | undefined): GitPeekTarget | null =>
    file ? { group: target.group, path: file.path } : null
  return {
    index: current + 1,
    total: files.length,
    previous: current > 0 ? targetFor(files[current - 1]) : null,
    next: current >= 0 && current < files.length - 1 ? targetFor(files[current + 1]) : null
  }
}
