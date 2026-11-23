import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { it, expect } from 'vitest'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { MarkdownHast } from '../../../../shared/ui/markdown/MarkdownHast'
import { markdownBlock } from '../../../../shared/compute/worker/markdown'
import { markdownDocumentBlocks } from '../../lib/markdownDocumentBlocks'
import { mergeTableChunks } from './mergeTableChunks'
function compare(source: string): void {
  const actual = markdownDocumentBlocks(source)
    .map((block) => {
      const roots = (block.table ?? [undefined]).map((table) => {
        const result = markdownBlock(
          { text: source },
          {
            kind: 'markdown',
            doc: { id: 'sample', revision: 1 },
            start: block.start,
            end: block.end,
            table
          }
        )
        if (!('hast' in result)) throw Error('unexpected raw block')
        return result.hast
      })
      return renderToStaticMarkup(
        createElement(MarkdownHast, {
          source: source.slice(block.start, block.end),
          hast: mergeTableChunks(roots)
        })
      )
    })
    .join('\n')
  const normalize = (html: string): string => html.replace(/<!-- -->/g, '').replace(/>\s+</g, '><')
  const expected = renderToStaticMarkup(createElement(Markdown, { source, className: 'fixture' }))
  expect(normalize('<div class="fixture">' + actual + '</div>')).toBe(normalize(expected))
}
it.each([
  '* a\n\n  ~~~\n  x\n  ~~~\n\n* b',
  '[site][ref]\n\n[ref]: https://example.com',
  '> first\n\n> second\n\n# heading',
  '![image](javascript:bad)\n\n<script>text</script>',
  'A[^1].\n\n[^1]: details',
  '* a\n* b\n</Warning>',
  '<CodeGroup>x</CodeGroup>\n\n<Note>y</Note>'
])('f1 matches complete Markdown render for %s', compare)
it.each([
  ['f3', 2, 201, 2],
  ['f3b wide', 50, 200, 1],
  ['f3b long', 3, 200, 1000]
] as const)(
  '%s merges table chunks without repeated headers or missing cells',
  (_, cols, rows, width) => {
    const line = (value: string): string => '|' + Array(cols).fill(value).join('|') + '|\n'
    const source =
      line('h') +
      line('---') +
      Array.from({ length: rows }, (_, i) => line(String(i) + 'x'.repeat(width))).join('')
    expect(markdownDocumentBlocks(source)[0].table!.length).toBeGreaterThan(1)
    compare(source)
  }
)
