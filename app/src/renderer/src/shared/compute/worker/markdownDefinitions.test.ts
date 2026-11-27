import { expect, it } from 'vitest'
import type { Element, Root } from 'hast'
import { markdownSegments } from '../../markdown/markdownSegments'
import { compute } from './handler'
import { markdownBlock } from './markdown'

function links(root: Root): Element[] {
  const result: Element[] = []
  const stack = [...root.children]
  while (stack.length) {
    const child = stack.shift()!
    if (child.type === 'element') {
      if (child.tagName === 'a') result.push(child)
      stack.unshift(...child.children)
    }
  }
  return result
}

it('resolves references across registrations using the first real CommonMark definition and retains source offsets', async () => {
  const first = '[go][Mixed Label] and `[code][mixed label]` plus \\[escaped] and [unknown][fake]'
  const last = '[back][left] and [later][mixed   label]'
  const source = [
    first,
    '[left]: /original',
    '~~~',
    '[fake]: /code-only',
    '~~~',
    ('p'.repeat(32000) + '\n\n').repeat(251),
    '> [MIXED LABEL]:\n>   <https://example.org/?a&amp;b>\n>   "right title"',
    '[mixed label]: /duplicate',
    last
  ].join('\n\n')
  const result = await compute({ kind: 'markdownLayout', source, sequence: 1 })
  if (!('segments' in result)) throw Error('missing layout')
  const segments = markdownSegments(source, result.segments)
  expect(segments.length).toBeGreaterThan(1)
  const targets = [first, last].map((line) => {
    const at = source.indexOf(line)
    const segment = segments.find((part) => part.start <= at && at < part.end)!
    const local = at - segment.start
    const block = segment.blocks.find((block) => block.start <= local && local < block.end)!
    const { hast } = markdownBlock(
      { text: segment.text },
      {
        kind: 'markdown',
        doc: { id: 'test', revision: 1 },
        start: block.start,
        end: block.end,
        definitions: segment.definitions
      }
    )
    return links(hast).map((link) => ({
      href: link.properties.href,
      title: link.properties.title,
      text: segment.text.slice(
        block.start + link.position!.start.offset!,
        block.start + link.position!.end.offset!
      )
    }))
  })
  expect(targets).toEqual([
    [{ href: 'https://example.org/?a&b', title: 'right title', text: '[go][Mixed Label]' }],
    [
      { href: '/original', title: undefined, text: '[back][left]' },
      { href: 'https://example.org/?a&b', title: 'right title', text: '[later][mixed   label]' }
    ]
  ])
})
