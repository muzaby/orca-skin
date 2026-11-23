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
it('문자 상한 또는 노드 예산을 넘으면 원문 경로를 선택한다', () => {
  expect(parseMarkdown('a'.repeat(50_001))).toEqual({ tooLarge: true })
  expect(parseMarkdown('**x** '.repeat(7000))).toEqual({ tooLarge: true })
})
