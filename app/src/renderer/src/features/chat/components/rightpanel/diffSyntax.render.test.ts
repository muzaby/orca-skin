import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import type { DiffLine } from '../../lib/diffLines'
import { DEFAULT_DIFF_VIEW } from '../../reducer/chatReducer'
import { FileDiffSection } from './FileDiffSection'

vi.mock('../../hooks/useDiffSyntax', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useDiffSyntax')>()
  return {
    ...actual,
    useDiffSyntax: (lines: readonly DiffLine[]) =>
      new Map(
        lines.map((line) => [
          line,
          {
            old: [{ content: line.text, color: '#112233' }],
            new: [{ content: line.text, color: '#445566' }]
          }
        ])
      )
  }
})

function render(layout: 'inline' | 'side-by-side'): ReturnType<typeof load> {
  return load(
    renderToStaticMarkup(
      createElement(FileDiffSection, {
        section: {
          path: 'src/a.ts',
          added: 1,
          removed: 1,
          patch: {
            path: 'src/a.ts',
            status: 'modified',
            kind: 'text',
            added: 1,
            removed: 1,
            lines: [
              { type: 'removed', oldLine: 1, newLine: null, text: 'const value = "<old>"' },
              { type: 'added', oldLine: null, newLine: 1, text: 'const value = "<new>"' },
              { type: 'unchanged', oldLine: 2, newLine: 2, text: 'const shared = 1' }
            ]
          }
        },
        collapsed: false,
        view: { ...DEFAULT_DIFF_VIEW, layout, highlightWords: true },
        requirements: [],
        draft: null,
        scrollOwnerRef: { current: null },
        tailSpacerRef: { current: null },
        onToggleCollapsed: () => {},
        onOpenFile: () => {}
      })
    )
  )
}

describe('diff syntax renderer', () => {
  it('나란히 보기의 동일 문맥도 old/new 색을 각각 선택한다', () => {
    const $ = render('side-by-side')
    const context = $('[data-diff-side-by-side] tr').last().find('pre')
    expect(context.eq(0).find('span').attr('style')).toBe('color:#112233')
    expect(context.eq(1).find('span').attr('style')).toBe('color:#445566')
    expect(context.map((_, node) => $(node).text()).get()).toEqual([
      'const shared = 1',
      'const shared = 1'
    ])
  })

  it('변경 강조가 토큰 중간을 잘라도 색·이스케이프·원문을 보존한다', () => {
    const $ = render('inline')
    const code = $('[data-diff-inline] pre')
    expect(code.eq(0).text()).toBe('const value = "<old>"')
    expect(code.eq(1).text()).toBe('const value = "<new>"')
    expect(code.find('old, new')).toHaveLength(0)
    expect(code.eq(0).find('mark span').attr('style')).toBe('color:#112233')
    expect(code.eq(1).find('mark span').attr('style')).toBe('color:#445566')
  })
})
