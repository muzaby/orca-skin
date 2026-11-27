import { indexFootnotes } from './markdownFootnotes'
import { MARKDOWN_DOC_SEGMENT_MAX_CHARS } from '../limits'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { RootContent } from 'mdast'
import { markdownDocumentBlocks } from '../../markdown/markdownDocumentBlocks'
import { markdownLayout, type MarkdownSegmentRange } from '../../markdown/markdownSegments'
import { topLevelFence } from '../../markdown/segmentedFence'
import { usedDefinitions } from './usedDefinitions'

const reader = unified().use(remarkParse).use(remarkGfm)

function entityEscape(value: string): string {
  return value.replace(/[&<>\\"\r\n]/g, (c) => `&#${c.charCodeAt(0)};`)
}

export function collectDefinitions(source: string): Map<string, string> {
  const definitions = new Map<string, string>()
  if (!source.includes(']:') || !/\[(?!\^)(?:\\[\s\S]|[^[\]\\]){1,999}\]:/u.test(source))
    return definitions
  for (const { start, end } of markdownDocumentBlocks(
    source,
    source.length <= MARKDOWN_DOC_SEGMENT_MAX_CHARS
  )) {
    const text = source.slice(start, end)
    if (!text.includes(']:') || topLevelFence(source, start, end)) continue
    const pending: RootContent[] = [...reader.parse(text).children].reverse()
    while (pending.length) {
      const node = pending.pop()!
      if (node.type === 'definition' && !definitions.has(node.identifier)) {
        const title = node.title == null ? '' : ' "' + entityEscape(node.title) + '"'
        definitions.set(
          node.identifier,
          `[${node.identifier}]: <${entityEscape(node.url)}>${title}`
        )
      }
      if ('children' in node)
        for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i])
    }
  }
  return definitions
}

export function workerMarkdownLayout(source: string): MarkdownSegmentRange[] {
  const splitFootnotes =
    source.length > MARKDOWN_DOC_SEGMENT_MAX_CHARS && source.includes('[^') && source.includes(']:')
  const layout = markdownLayout(source, !splitFootnotes)
  if (layout.length <= 1 || !source.includes(']:')) return layout
  const definitions = collectDefinitions(source)
  if (splitFootnotes) indexFootnotes(source, layout, definitions)
  if (!definitions.size) return layout
  return layout.map((segment) => ({
    ...segment,
    definitions: usedDefinitions(source.slice(segment.start, segment.end), definitions)
  }))
}
