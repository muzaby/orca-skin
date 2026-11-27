import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import ReactMarkdown from 'react-markdown'
import { Markdown } from './Markdown'

// Load Markdown against this suite's parser spy even when a setup import has already loaded it.
vi.hoisted(() => vi.resetModules())

vi.mock('react-markdown', async (original) => {
  const module = await original<typeof import('react-markdown')>()
  return { ...module, default: vi.fn(module.default) }
})

it('bypasses the full parser for ordinary fixture rows and retains it for GFM', () => {
  const parser = vi.mocked(ReactMarkdown)
  parser.mockClear()
  for (const source of [
    'Fixture prompt #10: explain module 10',
    'Step 4: reading `src/mod_10.ts`.'
  ]) {
    renderToStaticMarkup(
      createElement(Markdown, { source, sourceParts: [{ key: 'part', start: 0 }] })
    )
  }
  expect(parser).toHaveBeenCalledTimes(0)
  renderToStaticMarkup(createElement(Markdown, { source: 'Documentation at www.example.test' }))
  expect(parser).toHaveBeenCalledTimes(1)
})

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

it('matches the full GFM renderer and source part ownership for single paragraphs and code', () => {
  const sources = [
    'plain',
    '한글 단락 和文 résumé',
    'Fixture prompt #10: explain module 10',
    'Step 1 of turn 0: inspecting file `src/mod_0_0.ts`.',
    '`standalone`',
    'x `a.b` and `b-c`!',
    '1.0 tag',
    'x--y',
    '1.',
    '99)',
    '1234567890. literal',
    'a`x``y`',
    '`x```',
    '1. list',
    '999999999) list',
    '# heading',
    '<script>alert(1)</script>',
    '[javascript](javascript:alert(1))',
    'https://example.test',
    'www.example.test',
    'name@example.test',
    'Read FTP://example.test',
    'Read WWW.example.test',
    '![label](https://outside.test/img.png)',
    '<img src=x onerror=alert(1)>',
    'bare \u0000 character',
    'tab\tinside',
    'text with\rnew line',
    'abc😀',
    'É ́中',
    '~~deleted~~',
    '**bold**',
    'a\\*b',
    'x &amp; y',
    'ref[^1]',
    'code ` padded `',
    'two ``ticks``',
    'a\nb',
    'x | y\n--|--\na | b',
    '- [ ] task',
    '    indented',
    ' line ',
    '~~~ts\nx\n~~~',
    'Example:\n```ts\nexport const one = 1\n```',
    'Example `code`:\n```ts\nfirst\nsecond\n\n```',
    'Example:\n```js\nfirst\n```\nplain\n```',
    'Example:\n```js\nfirst\n  ```\nsecond\n```',
    'Example:\n```c++\nx\n```',
    'Example:\n```js\n\t<&>\n```',
    'Example:\n```js\n\u0000\n```',
    'Example:\n```js\n\n```'
  ]
  for (const source of sources) {
    for (const sourceParts of [
      undefined,
      [{ key: 'a', start: 0 }],
      Array.from({ length: source.length }, (_, start) => ({ key: 'part-' + start, start }))
    ]) {
      const render = (value: string): string =>
        renderToStaticMarkup(
          createElement(Markdown, { source: value, sourceParts, className: 'test' })
        )
      // Trailing blank lines force full remark/rehype processing without changing the block.
      expect(render(source), source).toBe(render(source + '\n\n'))
    }
  }
})
