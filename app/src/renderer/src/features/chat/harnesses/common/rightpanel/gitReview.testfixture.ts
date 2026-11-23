import { createElement, type ComponentProps } from 'react'
import { vi } from 'vitest'
import { DiffReview } from './DiffReview'
import { DEFAULT_DIFF_VIEW } from '../../../reducer/chatReducer'
import type { GitDiffPatch } from '../../../../../../../shared/ipc'
import { dom } from '../../../../../shared/ui/virtual/virtualView.testfixture'
type GitDiffPatchFile = GitDiffPatch['files'][number]
export function addedFile(count: number, path = 'a.txt'): GitDiffPatchFile {
  return {
    path,
    status: 'modified',
    kind: 'text',
    added: count,
    removed: 0,
    lines: Array.from({ length: count }, (_, i) => ({
      type: 'added',
      text: 'line ' + i,
      oldLine: null,
      newLine: i + 1
    }))
  }
}
export function renderGit(
  files: GitDiffPatchFile[],
  props: Partial<ComponentProps<typeof DiffReview>> = {}
): void {
  dom.render(
    createElement(DiffReview, {
      summary: null,
      patch: {
        files,
        base: { kind: 'none' },
        isRepo: true,
        unavailable: false,
        filesTruncated: false,
        contextLimited: false
      },
      hasRequest: true,
      comparison: { kind: 'all' },
      expandedFiles: new Set(files.map((f) => f.path)),
      sidebarVisible: false,
      view: DEFAULT_DIFF_VIEW,
      draft: null,
      requirements: [],
      onToggleExpanded: vi.fn(),
      onExpandFile: vi.fn(),
      onOpenFile: vi.fn(),
      onPickComparison: vi.fn(),
      ...props
    })
  )
}
