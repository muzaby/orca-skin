import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DiffRequirementItem, GitDiffSummary } from '../../../../../../shared/ipc'
import type { DiffRequirementDraft } from '../../reducer/chatReducer'
import { DiffPeek } from './DiffPeek'
import { diffRequirementLineKey } from './diffRequirements'

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

const requirement: DiffRequirementItem = {
  id: 'req-1',
  located: true,
  anchor: {
    sessionId: 'session-1',
    baselineCommit: 'base-oid',
    filePath: 'src/a.ts',
    oldLine: null,
    newLine: 2,
    hunkHeader: '@@ -1,2 +1,3 @@',
    contextBefore: ['before'],
    contextAfter: ['keep'],
    comment: 'Preserve this added branch',
    createdAt: 100
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

  it('inline + affordance, open draft, confirmed marker, removal affordance를 같은 diff 줄에 그린다', () => {
    const draft: DiffRequirementDraft = {
      key: diffRequirementLineKey('src/a.ts', null, 2),
      filePath: 'src/a.ts',
      oldLine: null,
      newLine: 2,
      body: 'open unsent comment'
    }
    const html = renderToStaticMarkup(
      createElement(DiffPeek, {
        summary,
        target: { group: { kind: 'uncommitted' }, path: 'src/a.ts' },
        currentBody: {
          key: 'body-key',
          generation: 7,
          content: {
            kind: 'text',
            oldValue: 'before\nkeep\n',
            newValue: 'before\nadded branch\nkeep\n',
            truncated: false
          }
        },
        requirements: [requirement],
        draft,
        onBack: () => undefined,
        onNavigate: () => undefined,
        onDraftChange: () => undefined,
        onAddRequirement: () => undefined,
        onRemoveRequirement: () => undefined
      })
    )

    expect(html).toContain('data-diff-requirement-add')
    expect(html).toContain('aria-label="Diff 요구사항 추가: +2"')
    expect(html).toContain('data-diff-requirement-draft="true"')
    expect(html).toContain('open unsent comment')
    expect(html).toContain('data-diff-requirement-marker="req-1"')
    expect(html).toContain('Preserve this added branch')
    expect(html).toContain('aria-label="Diff 요구사항 제거: Preserve this added branch"')
  })
})
