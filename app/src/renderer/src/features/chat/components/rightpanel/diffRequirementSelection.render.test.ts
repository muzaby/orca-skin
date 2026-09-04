import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import type { DiffRequirementItem, GitDiffPatch } from '../../../../../../shared/ipc'
import { DEFAULT_DIFF_VIEW } from '../../reducer/chatReducer'
import { RequirementTray } from '../composer/RequirementTray'
import { DiffReview } from './DiffReview'

const item = (id: string, line: number): DiffRequirementItem => ({
  id,
  located: true,
  anchor: {
    sessionId: 's',
    baselineCommit: 'base',
    filePath: 'src/a.ts',
    oldLine: line,
    newLine: line,
    hunkHeader: '',
    contextBefore: [],
    contextAfter: [],
    comment: `Comment ${id}`,
    createdAt: 1
  }
})
const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'head', oid: 'base' },
  filesTruncated: false,
  contextLimited: false,
  unavailable: false,
  files: [
    {
      path: 'src/a.ts',
      status: 'modified',
      added: 1,
      removed: 0,
      kind: 'text',
      lines: Array.from({ length: 100 }, (_, index) => ({
        type: index === 0 ? ('added' as const) : ('unchanged' as const),
        oldLine: index === 0 ? null : index + 1,
        newLine: index + 1,
        text: `line ${index + 1}`
      }))
    }
  ]
}

function review(
  requirements: DiffRequirementItem[],
  activeRequirementId: string | null,
  view = DEFAULT_DIFF_VIEW,
  content = patch
): string {
  return renderToStaticMarkup(
    createElement(DiffReview, {
      summary: null,
      patch: content,
      hasRequest: true,
      comparison: { kind: 'all' },
      expandedFiles: new Set(['src/a.ts']),
      sidebarVisible: false,
      view,
      requirements,
      draft: null,
      activeRequirementId,
      onToggleExpanded: () => {},
      onExpandFile: () => {},
      onOpenFile: () => {},
      onPickComparison: () => {}
    })
  )
}

describe('공유 코멘트 선택 표시', () => {
  it('같은 ID 하나만 diff와 composer 양쪽에서 활성으로 표시한다', () => {
    const requirements = [item('one', 2), item('two', 3)]
    const $ = load(
      review(requirements, 'two') +
        renderToStaticMarkup(
          createElement(RequirementTray, {
            requirements,
            selectedId: 'two',
            onRemove: () => {}
          })
        )
    )
    for (const marker of ['marker', 'chip']) {
      expect($(`[data-diff-requirement-${marker}="one"] button`).first().attr('aria-pressed')).toBe(
        'false'
      )
      expect($(`[data-diff-requirement-${marker}="two"] button`).first().attr('aria-pressed')).toBe(
        'true'
      )
      expect($(`[data-diff-requirement-${marker}="two"]`).attr('class')?.split(' ')).toContain(
        'border-selected'
      )
      expect($(`[data-diff-requirement-${marker}="one"]`).attr('class')).not.toContain(
        'focus-within:border-selected'
      )
    }
  })

  it('문맥 gap에 숨은 선택 코멘트를 작은 문맥과 함께 표시한다', () => {
    const $ = load(review([item('hidden', 50)], 'hidden'))
    expect($('[data-diff-requirement-marker="hidden"]').text()).toContain('Comment hidden')
    expect($('[data-diff-hunk-row-id="line:49"]')).toHaveLength(1)
    expect($('[data-diff-hunk-row-id="line:10"]')).toHaveLength(0)
    expect($('[data-diff-gap]').length).toBeGreaterThan(0)
  })

  it('나란히 보기의 같은 문맥 행에 코멘트를 중복하지 않고 선택한다', () => {
    const $ = load(
      review([item('hidden', 50)], 'hidden', { ...DEFAULT_DIFF_VIEW, layout: 'side-by-side' })
    )
    expect($('[data-diff-requirement-marker="hidden"]')).toHaveLength(1)
    expect($('[data-diff-requirement-marker="hidden"] button').first().attr('aria-pressed')).toBe(
      'true'
    )
  })

  it('공백 숨김으로 합쳐진 행에도 원래 추가·삭제 축의 코멘트가 남는다', () => {
    const content: GitDiffPatch = {
      ...patch,
      files: [
        {
          ...patch.files[0],
          lines: [
            { type: 'removed', oldLine: 1, newLine: null, text: 'const x=1' },
            { type: 'added', oldLine: null, newLine: 1, text: 'const x = 1' }
          ]
        }
      ]
    }
    const old = item('old', 1)
    old.anchor.newLine = null
    const next = item('new', 1)
    next.anchor.oldLine = null
    const $ = load(
      review([old, next], 'old', { ...DEFAULT_DIFF_VIEW, ignoreWhitespace: true }, content)
    )
    expect($('[data-diff-requirement-marker="old"]')).toHaveLength(1)
    expect($('[data-diff-requirement-marker="new"]')).toHaveLength(1)
  })

  it('위치를 잃은 선택 항목은 다른 줄에 붙이지 않는다', () => {
    expect(review([{ ...item('lost', 50), located: false }], 'lost')).not.toContain(
      'data-diff-requirement-marker="lost"'
    )
  })
})
