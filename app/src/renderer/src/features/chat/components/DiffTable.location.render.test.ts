import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../hooks/useDiffSyntax', () => ({ useDiffSyntax: () => new Map() }))

import { DiffTable } from './DiffTable'

describe('DiffTable absolute file axes', () => {
  it('renders the user-reported old 46 and new 47 instead of relative line 1', () => {
    const html = renderToStaticMarkup(
      createElement(DiffTable, {
        oldValue: 'async function animate(): Promise<void> {',
        newValue: 'async function animate2(): Promise<void> {',
        oldStartLine: 46,
        newStartLine: 47
      })
    )
    expect(html).toContain('>46</pre>')
    expect(html).toContain('>47</pre>')
  })

  it('does not present relative numbers as file lines without a unique patch match', () => {
    const html = renderToStaticMarkup(
      createElement(DiffTable, { oldValue: 'old', newValue: 'new' })
    )
    expect(html).not.toMatch(/<pre[^>]*>1<\/pre>/)
  })
})
