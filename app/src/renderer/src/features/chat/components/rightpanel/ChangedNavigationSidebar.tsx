import { useMemo, useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { formatRelativeTime } from '../../../../shared/i18n/datetime'
import {
  buildChangedFileTree,
  visibleTreeRows,
  type ChangedFileTreeNode
} from '../../lib/changedFileTree'
import { ALL_CHANGES, type DiffComparison, type DiffSection } from './diffComparison'
import type { GitDiffSummary } from '../../../../../../shared/ipc'

export interface ChangedNavigationSidebarProps {
  sections: readonly DiffSection[]
  summary: GitDiffSummary | null
  comparison: DiffComparison
  onPickFile: (path: string) => void
  onPickComparison: (comparison: DiffComparison) => void
}

/**
 * 탐색 사이드바 (0211 ΔV4 D-083·D-084). **두 구획**이다 — 상단 변경 파일 트리 + 하단 커밋 목록.
 *
 * 트리는 저장소 탐색기가 아니라 **현재 비교 범위의 변경 파일만** 담고, 파일을 고르면 우측
 * 본문의 그 섹션으로 이동한다(새 화면으로 가지 않는다). 하단 목록은 범위 선택 자리를 겸한다 —
 * `모든 변경사항` · `미커밋 변경` · 커밋 카드.
 */
export function ChangedNavigationSidebar({
  sections,
  summary,
  comparison,
  onPickFile,
  onPickComparison
}: ChangedNavigationSidebarProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const [collapsedDirs, setCollapsedDirs] = useState<ReadonlySet<string>>(() => new Set())
  const tree = useMemo(
    () =>
      buildChangedFileTree(
        sections.map((section) => ({
          path: section.path,
          added: section.added,
          removed: section.removed
        }))
      ),
    [sections]
  )
  const rows = useMemo(() => visibleTreeRows(tree, collapsedDirs), [tree, collapsedDirs])

  const toggleDir = (path: string): void =>
    setCollapsedDirs((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  return (
    <aside
      data-diff-sidebar
      className="flex w-[38%] min-w-0 shrink-0 animate-depth-in flex-col border-r border-t5"
    >
      <div data-diff-file-tree className="min-h-0 flex-1 overflow-y-auto px-p3 py-p3">
        {rows.length === 0 ? (
          <p className="px-p2 text-caption text-t5">{tr('chat.rightpanel.diffEmpty')}</p>
        ) : (
          rows.map(({ node, depth }) => (
            <TreeRow
              key={`${node.kind}:${node.path}`}
              node={node}
              depth={depth}
              collapsed={node.kind === 'dir' && collapsedDirs.has(node.path)}
              onToggleDir={toggleDir}
              onPickFile={onPickFile}
            />
          ))
        )}
      </div>
      <div
        data-diff-commit-list
        className="max-h-[45%] overflow-y-auto border-t border-t5 px-p3 py-p3"
      >
        <ScopeRow
          label={tr('chat.rightpanel.diffAllChanges')}
          active={comparison.kind === 'all'}
          testKey="all"
          onClick={() => onPickComparison(ALL_CHANGES)}
        />
        <ScopeRow
          label={tr('chat.rightpanel.diffUncommittedBlock')}
          active={comparison.kind === 'uncommitted'}
          testKey="uncommitted"
          onClick={() => onPickComparison({ kind: 'uncommitted' })}
        />
        {(summary?.commits ?? []).map((commit) => (
          <button
            key={commit.sha}
            type="button"
            data-diff-commit-card={commit.sha}
            aria-pressed={comparison.kind === 'commit' && comparison.sha === commit.sha}
            onClick={() => onPickComparison({ kind: 'commit', sha: commit.sha })}
            className={`group/commitcard mt-1 flex w-full flex-col gap-g1 rounded-r4 border border-t5 px-p3 py-p2 text-left outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover ${
              comparison.kind === 'commit' && comparison.sha === commit.sha ? 'border-accent' : ''
            }`}
          >
            <span className="truncate text-caption text-t9">{commit.subject}</span>
            <span className="truncate text-caption text-t5">
              {commit.sha.slice(0, 7)} · {commit.author} ·{' '}
              {formatRelativeTime(commit.committedAt, locale)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function ScopeRow({
  label,
  active,
  testKey,
  onClick
}: {
  label: string
  active: boolean
  testKey: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-diff-scope={testKey}
      aria-pressed={active}
      onClick={onClick}
      className={`group/scope flex w-full items-center gap-g2 rounded-r4 px-p2 py-1 text-left text-caption outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover ${
        active ? 'text-accent' : 'text-t7'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && <Icon name="check" size={11} className="shrink-0" />}
    </button>
  )
}

function TreeRow({
  node,
  depth,
  collapsed,
  onToggleDir,
  onPickFile
}: {
  node: ChangedFileTreeNode
  depth: number
  collapsed: boolean
  onToggleDir: (path: string) => void
  onPickFile: (path: string) => void
}): React.JSX.Element {
  const indent = { paddingLeft: `${depth * 10}px` }
  if (node.kind === 'dir') {
    return (
      <button
        type="button"
        style={indent}
        data-diff-tree-dir={node.path}
        aria-expanded={!collapsed}
        onClick={() => onToggleDir(node.path)}
        className="group/treedir flex w-full items-center gap-g2 rounded-r4 px-p2 py-1 text-left text-caption text-t7 outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
      >
        <Icon
          name={collapsed ? 'chevR' : 'chevD'}
          size={11}
          className="shrink-0 text-t5 transition-colors group-hover/treedir:text-t7"
        />
        <Icon name="folder" size={11} className="shrink-0 text-t5" />
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      style={indent}
      data-diff-tree-file={node.path}
      onClick={() => onPickFile(node.path)}
      className="group/treefile flex w-full items-center gap-g2 rounded-r4 px-p2 py-1 text-left text-caption text-t7 outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
    >
      <Icon
        name="doc"
        size={11}
        className="ml-[13px] shrink-0 text-t5 transition-colors group-hover/treefile:text-t7"
      />
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
      <span className="flex shrink-0 gap-g1 tabular-nums">
        <span className="text-git-added">+{node.added}</span>
        <span className="text-git-removed">−{node.removed}</span>
      </span>
    </button>
  )
}
