import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import { DiffPeek } from './DiffPeek'

const summary: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid' },
  files: [],
  totals: { added: 1, removed: 1 },
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: {
    files: [{ path: 'src/a.ts', status: 'modified', added: 1, removed: 1, binary: false }],
    totals: { added: 1, removed: 1 },
    filesTruncated: false
  }
}

describe('Diff Peek SSR', () => {
  it('path·group 제한 navigation·inspectable scroll owner를 포함한 두 번째 화면을 그린다', () => {
    const html = renderToStaticMarkup(
      createElement(DiffPeek, {
        summary,
        target: { group: { kind: 'uncommitted' }, path: 'src/a.ts' },
        currentBody: {
          key: 'body-key',
          generation: 7,
          content: { kind: 'text', oldValue: 'before', newValue: 'after', truncated: false }
        },
        onBack: () => undefined,
        onNavigate: () => undefined
      })
    )

    expect(html).toContain('data-session-changes-screen="peek"')
    expect(html).toContain('data-diff-peek-scroll-owner')
    expect(html).toContain('src/a.ts')
    expect(html).toContain('미커밋 변경 포함')
    expect(html).toContain('before')
    expect(html).toContain('after')
  })
})
