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
it('mw6 문자 상한 또는 노드 예산을 넘으면 원문 경로를 선택한다', () => {
  expect(parseMarkdown('a'.repeat(50_001))).toEqual({ tooLarge: true })
  expect(parseMarkdown('**x** '.repeat(7000))).toEqual({ tooLarge: true })
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
