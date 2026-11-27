import { it, expect } from 'vitest'
import { markdownDocumentBlocks } from '../../../shared/markdown/markdownDocumentBlocks'
function texts(source: string): string[] {
  return markdownDocumentBlocks(source).map((b) => source.slice(b.start, b.end))
}
it('mb1 separates top-level paragraphs without losing source offsets', () => {
  const s = 'one\n\ntwo'
  expect(texts(s)).toEqual(['one\n\n', 'two'])
})
it('mb2 preserves an indented nested fence', () => {
  const s = '* list\n\n  ```js\n  example\n  ```\n'
  expect(texts(s)).toEqual([s])
})
it('mb3 preserves loose lists', () => {
  const s = '* one\n\n* two\n'
  expect(texts(s)).toEqual([s])
})
it('mb4 preserves quote continuations', () => {
  const s = '> one\n\n> two\n'
  expect(texts(s)).toEqual([s])
})
it('mb5 keeps a footnote with its reference across the whole document', () => {
  for (const n of [10, 50001]) {
    const s = 'x'.repeat(n) + '[^1]\n\n[^1]: foot'
    expect(markdownDocumentBlocks(s)).toEqual([{ start: 0, end: s.length }])
  }
})
it('mb6 retains final newline of a list before HTML', () => {
  const s = '* a\n* b\n</Warning>\n'
  expect(texts(s).join('')).toBe(s)
  expect(texts(s).at(-1)).toMatch(/\n$/)
})
it.each([
  ['<script>', '</script>'],
  ['<!--', '-->'],
  ['<?', '?>'],
  ['<![CDATA[', ']]>'],
  ['<!DOCTYPE', '>']
])('mb7 holds open HTML %s until closure', (open, close) => {
  const fragment = open + '\n\n# not a heading\n\n' + close
  const result = texts(fragment + '\n\n# after')
  expect(result[0].trimEnd()).toBe(fragment)
  expect(result.at(-1)).toBe('# after')
})
it('mb8 keeps adjacent HTML together', () => {
  const s = '<CodeGroup>code</CodeGroup>\n\n<Note>note</Note>'
  expect(texts(s)).toEqual([s])
})
it('mb9 keeps oversized paragraphs in the worker path', () => {
  for (const size of [50000, 50001])
    expect(markdownDocumentBlocks('a'.repeat(size))[0]).toEqual({ start: 0, end: size })
})
function table(cols: number, rows: number, cellSize: number): string {
  const line = (cell: string): string => '|' + Array(cols).fill(cell).join('|') + '|\n'
  return line('h') + line('---') + line('x'.repeat(cellSize)).repeat(rows)
}
it('mb10 chunks at 200 rows, continues past 2000 rows', () => {
  expect(markdownDocumentBlocks(table(2, 201, 1))[0].table).toHaveLength(2)
  expect(markdownDocumentBlocks(table(2, 2001, 1))[0].table).toHaveLength(11)
})
it('mb11 applies row, cell and character budgets independently', () => {
  for (const [cols, rows, size, count] of [
    [20, 400, 1, 9],
    [50, 200, 1, 11],
    [3, 200, 1000, 13]
  ]) {
    const s = table(cols, rows, size),
      block = markdownDocumentBlocks(s)[0]
    expect(block.table).toHaveLength(count)
    for (const chunk of block.table!) {
      const n = s.slice(...chunk.rows).split('\n').length - 1
      expect((n + 1) * cols).toBeLessThanOrEqual(1000)
      expect(chunk.headerEnd + chunk.rows[1] - chunk.rows[0]).toBeLessThanOrEqual(50000)
    }
  }
  for (const s of [table(501, 1, 1), table(1, 1, 50001)])
    expect(markdownDocumentBlocks(s)[0]).toEqual({ start: 0, end: s.length })
})

it('mb2 keeps a following indented paragraph in the same worker block', () => {
  const source = 'one\n\n item'
  expect(texts(source)).toEqual([source])
})
