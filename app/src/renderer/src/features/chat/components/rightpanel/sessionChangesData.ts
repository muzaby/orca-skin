import type {
  GitDiffCommit,
  GitDiffFileEntry,
  GitDiffSummary,
  GitDiffTotals
} from '../../../../../../shared/ipc'
import type { MessageKey } from '../../../../shared/i18n'
import type { GitPeekGroup } from '../../reducer/chatReducer'

export interface SessionChangeGroup {
  group: GitPeekGroup
  files: readonly GitDiffFileEntry[]
  totals: GitDiffTotals | null
  filesTruncated: boolean
  commit: GitDiffCommit | null
}

export type CommitDisplayMeta =
  | { kind: 'unavailable' }
  | { kind: 'available'; fileCount: number; totals: GitDiffTotals; remainingFileCount: number }

export const COMMIT_FILE_PREVIEW_LIMIT = 2

export interface CommitFileRows {
  loadedFiles: readonly GitDiffFileEntry[]
  /** 아직 summary에 이미 들어왔지만 collapse 때문에 숨긴 행 수. */
  moreLoadedCount: number
  /** summary cap에 걸려 전체 `fileCount` 중 일부를 현재 renderer가 전혀 갖지 못한다. */
  partial: boolean
}

/** `null`은 수집 실패이고 0은 실제 수치다. 화면에서도 이 두 상태를 섞지 않는다. */
export function commitDisplayMeta(commit: GitDiffCommit): CommitDisplayMeta {
  if (commit.fileCount === null || commit.totals === null) return { kind: 'unavailable' }
  return {
    kind: 'available',
    fileCount: commit.fileCount,
    totals: commit.totals,
    remainingFileCount: Math.max(0, commit.fileCount - commit.files.length)
  }
}

/**
 * Expansion은 이미 받은 commit.files 안에서만 일어난다. fileCount가 더 커도 renderer는
 * 추가 fetch contract가 없으므로, loaded 밖의 행을 `+N개 더`로 약속하지 않는다.
 */
export function commitFileRows(commit: GitDiffCommit, expanded: boolean): CommitFileRows {
  const loadedFiles = expanded ? commit.files : commit.files.slice(0, COMMIT_FILE_PREVIEW_LIMIT)
  return {
    loadedFiles,
    moreLoadedCount: expanded ? 0 : Math.max(0, commit.files.length - loadedFiles.length),
    partial: commit.filesTruncated
  }
}

/** Timeline commit 노드와 마지막 uncommitted block은 항상 분리된 목록 group이다. */
export function sessionChangeGroups(summary: GitDiffSummary): readonly SessionChangeGroup[] {
  return [
    ...summary.commits.map((commit) => ({
      group: { kind: 'commit' as const, sha: commit.sha },
      files: commit.files,
      totals: commit.totals,
      filesTruncated: commit.filesTruncated,
      commit
    })),
    {
      group: { kind: 'uncommitted' as const },
      files: summary.uncommitted.files,
      totals: summary.uncommitted.totals,
      filesTruncated: summary.uncommitted.filesTruncated,
      commit: null
    }
  ]
}

export function summaryNoticeKeys(summary: GitDiffSummary): readonly MessageKey[] {
  return [
    ...(summary.filesTruncated ? (['chat.rightpanel.diffSessionFilesTruncated'] as const) : []),
    ...(summary.commitsTruncated ? (['chat.rightpanel.diffSessionCommitsTruncated'] as const) : []),
    ...(summary.commitFilesUnavailable
      ? (['chat.rightpanel.diffSessionCommitFilesUnavailable'] as const)
      : [])
  ]
}

export function summaryBaseLabel(summary: GitDiffSummary): string {
  return summary.base.kind === 'none' ? '∅' : summary.base.oid.slice(0, 7)
}
