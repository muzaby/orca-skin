import type { GitDiffFileEntry, GitDiffSummary } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import type { GitPeekGroup, GitPeekTarget } from '../../reducer/chatReducer'
import { commitDisplayMeta, commitFileRows, summaryBaseLabel } from './sessionChangesData'

interface SessionChangesListProps {
  summary: GitDiffSummary | null
  expandedCommitIds: ReadonlySet<string>
  onToggleCommit: (sha: string) => void
  onOpenPeek: (target: GitPeekTarget) => void
}

function ChangeFileRow({
  file,
  group,
  onOpenPeek
}: {
  file: GitDiffFileEntry
  group: GitPeekGroup
  onOpenPeek: (target: GitPeekTarget) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-session-change-file={file.path}
      onClick={() => onOpenPeek({ group, path: file.path })}
      className="flex w-full items-center gap-g3 rounded-r3 px-p5 py-1 text-left text-body text-t7 outline-none hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
    >
      <span className="min-w-0 flex-1 truncate font-mono text-caption">{file.path}</span>
      <span className="flex shrink-0 gap-g1 tabular-nums">
        <span className="text-git-added">+{file.added}</span>
        <span className="text-git-removed">−{file.removed}</span>
      </span>
    </button>
  )
}

function Totals({ added, removed }: { added: number; removed: number }): React.JSX.Element {
  return (
    <span className="flex shrink-0 gap-g1 text-caption tabular-nums">
      <span className="text-git-added">+{added}</span>
      <span className="text-git-removed">−{removed}</span>
    </span>
  )
}

/** 첫 화면. commit timeline과 uncommitted를 별도 group으로 보존해 peek navigation의 축도 고정한다. */
export function SessionChangesList({
  summary,
  expandedCommitIds,
  onToggleCommit,
  onOpenPeek
}: SessionChangesListProps): React.JSX.Element {
  const { tr } = useI18n()
  if (!summary) return <div data-session-changes-screen="list" className="min-h-0 flex-1" />
  if (!summary.isRepo) {
    return (
      <p data-session-changes-screen="list" className="px-p5 py-p4 text-body text-t6">
        {tr('chat.rightpanel.diffNotRepo')}
      </p>
    )
  }

  return (
    <div data-session-changes-screen="list" className="min-h-0 flex-1 overflow-y-auto">
      <section data-session-summary className="flex flex-col gap-g2 border-b border-t5 px-p5 py-p4">
        <span className="font-serif text-body font-semibold text-t9">
          {tr('chat.rightpanel.diffSessionChanges')}
        </span>
        <span className="text-caption text-t6">
          {tr('chat.rightpanel.diffBaselineCurrent', { base: summaryBaseLabel(summary) })}
        </span>
        <div className="flex flex-wrap items-center gap-g2 text-caption text-t6">
          <Totals added={summary.totals.added} removed={summary.totals.removed} />
          <span>{tr('chat.rightpanel.diffTrackedFiles', { count: summary.files.length })}</span>
          <span>{tr('chat.rightpanel.diffUntrackedExcluded')}</span>
        </div>
        <div className="flex flex-wrap gap-g2 text-caption text-t6">
          <span className="rounded-full bg-fill-muted px-2 py-[2px]">
            {tr('chat.rightpanel.diffCommitChip', { count: summary.commits.length })}
          </span>
          <span className="rounded-full bg-fill-muted px-2 py-[2px]">
            {tr('chat.rightpanel.diffFileChip', { count: summary.files.length })}
          </span>
          <span className="rounded-full bg-fill-muted px-2 py-[2px]">
            {tr('chat.rightpanel.diffUncommittedChip', { count: summary.uncommitted.files.length })}
          </span>
        </div>
      </section>

      <div className="flex flex-col gap-g4 px-p5 py-p4">
        {summary.commits.map((commit) => {
          const group: GitPeekGroup = { kind: 'commit', sha: commit.sha }
          const expanded = expandedCommitIds.has(commit.sha)
          const meta = commitDisplayMeta(commit)
          const rows = commitFileRows(commit, expanded)
          const canToggle =
            meta.kind === 'available' && commit.files.length > rows.loadedFiles.length
          return (
            <article
              key={commit.sha}
              data-session-commit={commit.sha}
              className="border-l border-t5 pl-p4"
            >
              <div className="flex items-start justify-between gap-g3">
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-t9">{commit.subject}</p>
                  <p className="text-caption text-t5">
                    {commit.author} · {new Date(commit.committedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-caption text-t5">
                  {commit.sha.slice(0, 7)}
                </span>
              </div>
              {commit.body && (
                <p className="mt-1 whitespace-pre-wrap text-caption text-t6">{commit.body}</p>
              )}
              {meta.kind === 'available' ? (
                <div className="mt-2 flex items-center gap-g3 text-caption text-t6">
                  <span>
                    {tr('chat.rightpanel.diffCommitFileCount', { count: meta.fileCount })}
                  </span>
                  <Totals added={meta.totals.added} removed={meta.totals.removed} />
                </div>
              ) : (
                <p className="mt-2 text-caption text-t5">
                  {tr('chat.rightpanel.diffFileMetadataUnavailable')}
                </p>
              )}
              <div className="mt-2 flex flex-col gap-[2px]">
                {rows.loadedFiles.map((file) => (
                  <ChangeFileRow
                    key={file.path}
                    file={file}
                    group={group}
                    onOpenPeek={onOpenPeek}
                  />
                ))}
              </div>
              {canToggle && (
                <button
                  type="button"
                  onClick={() => onToggleCommit(commit.sha)}
                  className="mt-2 text-caption text-accent outline-none hide-focus-ring ring-focus"
                >
                  {tr('chat.rightpanel.diffMoreFiles', { count: rows.moreLoadedCount })}
                </button>
              )}
              {expanded && commit.files.length > 2 && (
                <button
                  type="button"
                  onClick={() => onToggleCommit(commit.sha)}
                  className="mt-2 block text-caption text-accent outline-none hide-focus-ring ring-focus"
                >
                  {tr('chat.rightpanel.diffCollapseFiles')}
                </button>
              )}
              {rows.partial && (
                <p className="mt-2 text-caption text-t5">
                  {tr('chat.rightpanel.diffPartialFiles')}
                </p>
              )}
            </article>
          )
        })}
      </div>

      <section data-session-uncommitted className="border-t border-t5 px-p5 py-p4">
        <div className="flex items-center justify-between gap-g3">
          <h3 className="text-body font-medium text-t9">
            {tr('chat.rightpanel.diffUncommittedBlock')}
          </h3>
          <Totals
            added={summary.uncommitted.totals.added}
            removed={summary.uncommitted.totals.removed}
          />
        </div>
        <div className="mt-2 flex flex-col gap-[2px]">
          {summary.uncommitted.files.map((file) => (
            <ChangeFileRow
              key={file.path}
              file={file}
              group={{ kind: 'uncommitted' }}
              onOpenPeek={onOpenPeek}
            />
          ))}
        </div>
        {summary.uncommitted.filesTruncated && (
          <p className="mt-2 text-caption text-t5">{tr('chat.rightpanel.diffPartialFiles')}</p>
        )}
      </section>
    </div>
  )
}
