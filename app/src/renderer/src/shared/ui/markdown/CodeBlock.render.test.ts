import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CodeBlock } from './CodeBlock'

describe('source viewer fallback', () => {
  it('shows all line numbers for plain text before a grammar is available', () => {
    const html = renderToStaticMarkup(
      createElement(CodeBlock, {
        code: 'first\n\n<script>alert(1)</script>\n',
        lang: 'text',
        showLineNumbers: true,
        showHeader: false,
        embedded: true
      })
    )
    expect(html).toContain('1\n2\n3\n4</span>')
    expect(html).toContain('first\n\n&lt;script&gt;alert(1)&lt;/script&gt;\n')
    expect(html).not.toContain('<script>')
  })

  it('keeps non-numbered transcript code as plain text', () => {
    const html = renderToStaticMarkup(
      createElement(CodeBlock, { code: 'one\ntwo', showHeader: false })
    )
    expect(html).toContain('<code>one\ntwo</code>')
    expect(html).not.toContain('aria-hidden="true"')
  })
})
