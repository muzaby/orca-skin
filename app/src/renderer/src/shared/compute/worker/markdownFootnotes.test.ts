import { expect, it } from 'vitest'
import type { Element, Root } from 'hast'
import { indexFootnotes } from './markdownFootnotes'
import { collectDefinitions } from './markdownDefinitions'
import { parseMarkdown } from './markdown'
import type { MarkdownSegmentRange } from '../../markdown/markdownSegments'

it('keeps nested footnotes, safe links and absolute positions identical to one GFM document', () => {
  const parts = [
    'intro[^b]\r\n\r\n[^a]: **Alpha**\r\n\r\n',
    '[^b]: nested[^A], [site][url], [unsafe](javascript:bad)\r\n\r\n[url]: /safe\r\n'
  ]
  const source = parts.join('')
  let cursor = 0
  const layout: MarkdownSegmentRange[] = parts.map((text) => {
    const start = cursor
    cursor += text.length
    return { start, end: cursor, blocks: [{ start: 0, end: text.length }] }
  })
  indexFootnotes(source, layout, collectDefinitions(source))
  function footer(tree: Root): Element | undefined {
    return tree.children.find(
      (n): n is Element => n.type === 'element' && n.properties.dataFootnotes === true
    )
  }
  const wanted = footer(parseMarkdown(source).hast)
  expect(wanted).toBeDefined()
  expect(footer(layout[1].footnoteFooter!)).toEqual(wanted)
})
