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

/**
 * 기준선 자리에 무엇이 서는가. `head` 는 **세션 기준선을 모른다**는 뜻이라 sha 를 쓰면
 * 그 sha 가 이 세션의 출발점인 것처럼 읽힌다 — 그 자리는 `HEAD` 문구가 갖는다(AT-28).
 */
export type SummaryBaseLabel = { kind: 'oid'; oid: string } | { kind: 'head' } | { kind: 'none' }

export function summaryBaseLabel(summary: GitDiffSummary): SummaryBaseLabel {
  if (summary.base.kind === 'none') return { kind: 'none' }
  if (summary.base.kind === 'head') return { kind: 'head' }
  return { kind: 'oid', oid: summary.base.oid.slice(0, 7) }
}

/** 위 판정을 화면 문자열로 옮긴다 — 두 표면이 같은 규칙을 쓰도록 한 자리에 둔다. */
export function summaryBaseText(summary: GitDiffSummary, tr: (key: MessageKey) => string): string {
  const label = summaryBaseLabel(summary)
  if (label.kind === 'oid') return label.oid
  if (label.kind === 'head') return tr('chat.rightpanel.diffBaselineHead')
  return '∅'
}
