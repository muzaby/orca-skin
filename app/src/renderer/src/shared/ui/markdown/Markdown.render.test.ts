import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Markdown } from './Markdown'

it.each(['https://example.test/path?q=1', 'http://example.test/path'])(
  'routes Markdown link %s through external window navigation',
  (url) => {
    const html = renderToStaticMarkup(createElement(Markdown, { source: `[외부 문서](${url})` }))
    const anchor = html.match(/<a\b[^>]*>/)?.[0]
    expect(anchor).toBeDefined()
    expect(anchor).toContain(`href="${url}"`)
    expect(anchor).toContain('target="_blank"')
    expect(anchor).toContain('rel="noopener noreferrer"')
    expect(html).toContain('외부 문서</a>')
  }
)
