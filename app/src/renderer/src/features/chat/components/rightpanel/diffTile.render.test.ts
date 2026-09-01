import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GitDiffFileEntry, GitDiffSummary } from '../../../../../../shared/ipc'
import { DiffTileContentView } from './DiffTileContent'
import { DiffTileHeaderView } from './DiffTileHeader'
import { tileById } from './tileRegistry'

const file = (path: string): GitDiffFileEntry => ({
  path,
  status: 'modified',
  added: 1,
  removed: 0,
  binary: false
})
const summary: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid' },
  files: [file('src/a.ts')],
  totals: { added: 1, removed: 0 },
  filesTruncated: false,
  commits: [
    {
      sha: 'commit-a',
      subject: 'A',
      author: 'codex',
      committedAt: 0,
      files: [file('src/a.ts')],
      filesTruncated: false,
      fileCount: 1,
      totals: { added: 1, removed: 0 }
    }
  ],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: {
    files: [file('src/a.ts')],
    totals: { added: 1, removed: 0 },
    filesTruncated: false
  }
}

describe('diff tile — exactly two screens', () => {
  it('peek target이 없으면 Session Changes만 그린다', () => {
    const html = renderToStaticMarkup(
      createElement(DiffTileContentView, {
        summary,
        peekTarget: null,
        expandedCommitIds: new Set<string>(),
        currentBody: null,
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined,
        onBack: () => undefined
      })
    )

    expect(html).toContain('data-session-changes-screen="list"')
    expect(html).not.toContain('data-session-changes-screen="peek"')
    expect(html).not.toContain('data-diff-region="tree"')
  })

  it('peek target이 있으면 Diff Peek만 그리고 current body generation을 전달한다', () => {
    const html = renderToStaticMarkup(
      createElement(DiffTileContentView, {
        summary,
        peekTarget: { group: { kind: 'commit', sha: 'commit-a' }, path: 'src/a.ts' },
        expandedCommitIds: new Set<string>(),
        currentBody: {
          key: 'body',
          generation: 2,
          content: { kind: 'text', oldValue: 'old', newValue: 'new', truncated: false }
        },
        onToggleCommit: () => undefined,
        onOpenPeek: () => undefined,
        onBack: () => undefined
      })
    )

    expect(html).toContain('data-session-changes-screen="peek"')
    expect(html).not.toContain('data-session-changes-screen="list"')
    expect(html).toContain('old')
    expect(html).toContain('new')
  })
})

describe('diff tile header and registry', () => {
  it('header는 branch와 explicit refresh만 두고 tree toggle을 제거한다', () => {
    const html = renderToStaticMarkup(
      createElement(DiffTileHeaderView, {
        branch: 'feature/session',
        title: '세션 변경 사항',
        onRefresh: () => undefined
      })
    )

    expect(html).toContain('feature/session')
    expect(html).toContain('세션 변경 사항')
    expect((html.match(/<button/g) ?? []).length).toBe(1)
    expect(html).not.toContain('파일 목록')
  })

  it('기존 tile registry wrapper가 새 list screen을 계속 연결한다', () => {
    const tile = tileById('diff')
    const html = renderToStaticMarkup(createElement(tile.Content))
    expect(tile.HeaderContent).toBeDefined()
    expect(html).toContain('data-session-changes-screen="list"')
  })
})
