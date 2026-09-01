import { describe, expect, it } from 'vitest'
import type { GitDiffFileEntry, GitDiffSummary } from '../../../../../../shared/ipc'
import type { GitPeekTarget } from '../../reducer/chatReducer'
import { peekNavigation } from './peekNavigation'

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
  files: [file('session-only.ts')],
  totals: { added: 3, removed: 1 },
  filesTruncated: false,
  commits: [
    {
      sha: 'commit-a',
      subject: 'A',
      author: 'codex',
      committedAt: 0,
      files: [file('a.ts'), file('shared.ts')],
      filesTruncated: false,
      fileCount: 2,
      totals: { added: 2, removed: 0 }
    },
    {
      sha: 'commit-b',
      subject: 'B',
      author: 'claude',
      committedAt: 0,
      files: [file('b.ts')],
      filesTruncated: false,
      fileCount: 1,
      totals: { added: 1, removed: 0 }
    }
  ],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: {
    files: [file('shared.ts'), file('worktree.ts')],
    totals: { added: 1, removed: 1 },
    filesTruncated: false
  }
}

describe('diff peek navigation', () => {
  it('commit group에서는 해당 commit의 파일만 앞뒤로 이동한다', () => {
    const target: GitPeekTarget = { group: { kind: 'commit', sha: 'commit-a' }, path: 'shared.ts' }

    expect(peekNavigation(summary, target)).toEqual({
      index: 2,
      total: 2,
      previous: { group: { kind: 'commit', sha: 'commit-a' }, path: 'a.ts' },
      next: null
    })
  })

  it('uncommitted group은 같은 path가 commit에도 있어도 별도의 후보 집합을 쓴다', () => {
    const target: GitPeekTarget = { group: { kind: 'uncommitted' }, path: 'shared.ts' }

    expect(peekNavigation(summary, target)).toEqual({
      index: 1,
      total: 2,
      previous: null,
      next: { group: { kind: 'uncommitted' }, path: 'worktree.ts' }
    })
  })
})
