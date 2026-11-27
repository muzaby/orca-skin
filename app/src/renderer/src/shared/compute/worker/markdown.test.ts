import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Markdown } from '../../ui/markdown/Markdown'
import { MarkdownHast } from '../../ui/markdown/MarkdownHast'
import { parseMarkdown } from './markdown'

it.each([
  '| a | b |\n|:-|--:|\n| &copy; | [site](https://example.org) |',
  '- [x] done\n- [ ] todo',
  '<script>literal</script>\n\n[blocked](javascript:alert%281%29)',
  '> **bold** and `code`\n\n![image](https://example.org/image.png)',
  '[a][ref]\n\n[ref]: https://example.org'
])('워커 출력이 기존 Markdown 본문 및 URL·HTML 처리와 같다 (%s)', (source) => {
  const result = parseMarkdown(source)
  if (!('hast' in result)) throw new Error('unexpected node limit')
  const actual = renderToStaticMarkup(createElement(MarkdownHast, { hast: result.hast, source }))
  const wrapped = renderToStaticMarkup(createElement(Markdown, { source, className: 'test' }))
  expect('<div class="test">' + actual + '</div>').toBe(wrapped)
})
it('AC8 parses beyond 50,000 chars and 20,000 nodes', () => {
  expect(parseMarkdown('a'.repeat(50_001)).hast.children[0]).toMatchObject({
    tagName: 'p',
    children: [{ value: 'a'.repeat(50_001) }]
  })
  expect(parseMarkdown('**x** '.repeat(7000)).hast.children[0]).toHaveProperty(
    'children.length',
    13999
  )
})

it('mw6 a wide table chunk stays below the node budget and retains all cells', () => {
  const line = (value: string): string => '|' + Array(50).fill(value).join('|') + '|\n'
  const result = parseMarkdown(line('key') + line('---') + line('x').repeat(19))
  if (!('hast' in result)) throw Error('a bounded chunk must produce a tree')
  let nodes = 0,
    cells = 0
  const count = (node: import('hast').Root | import('hast').RootContent): void => {
    nodes++
    if (node.type === 'element' && ['td', 'th'].includes(node.tagName)) cells++
    if ('children' in node) node.children.forEach(count)
  }
  count(result.hast)
  expect(cells).toBe(1000)
  expect(nodes).toBeLessThanOrEqual(20000)
})

it('keeps the source offsets and delimiter context after a long ordinary prefix', () => {
  const prefix = '한글과 words '.repeat(5000)
  const source = prefix + '**bold** and https://example.org'
  const result = parseMarkdown(source).hast
  expect(result.children[0]).toMatchObject({
    tagName: 'p',
    children: [
      {
        type: 'text',
        value: prefix,
        position: { start: { offset: 0 }, end: { offset: prefix.length } }
      },
      {
        tagName: 'strong',
        children: [{ value: 'bold', position: { start: { offset: prefix.length + 2 } } }]
      },
      { value: ' and ' },
      { tagName: 'a', properties: { href: 'https://example.org' } }
    ]
  })
  expect(result.position?.end.offset).toBe(source.length)
})

it('retains trailing source positions when a large prose block ends in blank lines', async () => {
  const { unified } = await import('unified')
  const { default: remarkParse } = await import('remark-parse')
  const { default: gfm } = await import('remark-gfm')
  const { default: rehype } = await import('remark-rehype')
  const original = unified().use(remarkParse).use(gfm).use(rehype)
  for (const ending of ['', '   ', '\n\n', '  \r\n\r\n']) {
    const source = '가 and '.repeat(1000) + 'end' + ending
    expect(parseMarkdown(source).hast).toEqual(original.runSync(original.parse(source)))
  }
})
