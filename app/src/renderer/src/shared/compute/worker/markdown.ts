import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import type { Root, RootContent } from 'hast'
import { defaultUrlTransform } from 'react-markdown'
import { MARKDOWN_BLOCK_MAX_CHARS, MARKDOWN_HAST_MAX_NODES } from '../limits'
import type { ComputeResults } from '../protocol'

const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })

export function parseMarkdown(source: string): ComputeResults['markdown'] {
  if (source.length > MARKDOWN_BLOCK_MAX_CHARS) return { tooLarge: true }
  const hast = parser.runSync(parser.parse(source)) as Root
  const pending: (Root | RootContent)[] = [hast]
  let nodes = 0
  while (pending.length) {
    const node = pending.pop()!
    if (++nodes > MARKDOWN_HAST_MAX_NODES) return { tooLarge: true }
    if (node.type === 'element') {
      for (const key of ['href', 'src']) {
        const url = node.properties[key]
        if (typeof url === 'string') node.properties[key] = defaultUrlTransform(url)
      }
    }
    if ('children' in node) {
      for (const [index, child] of node.children.entries()) {
        if (child.type === 'raw') {
          const text = { type: 'text' as const, value: child.value, position: child.position }
          node.children[index] = text
          pending.push(text)
        } else pending.push(child)
      }
    }
  }
  return { hast }
}

export interface MarkdownDocument {
  text: string
  definitions?: Map<string, string>
}
export function markdownBlock(
  doc: MarkdownDocument,
  request: import('../protocol').MarkdownRequest
): ComputeResults['markdown'] {
  const { start, end, table } = request
  const source = table
    ? doc.text.slice(start, table.headerEnd) + doc.text.slice(...table.rows)
    : doc.text.slice(start, end)
  if (!source.includes('[') || (start === 0 && end === doc.text.length && !table))
    return parseMarkdown(source)
  if (!doc.definitions) {
    const defs = new Map<string, string>()
    let fence: string | undefined
    for (const line of doc.text.split('\n')) {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
      if (marker && !fence) {
        fence = marker
        continue
      }
      if (fence) {
        if (marker && marker.startsWith(fence) && line.trim() === marker) fence = undefined
        continue
      }
      const match = /^ {0,3}\[([^\]^]+)\]:\s*\S.*$/.exec(line)
      if (match) {
        const key = match[1].trim().replace(/\s+/g, ' ').toLowerCase()
        if (!defs.has(key)) defs.set(key, line)
      }
    }
    doc.definitions = defs
  }
  const references = new Set<string>()
  for (const match of source.matchAll(/\[([^\]\n]+)\]/g)) {
    const def = doc.definitions.get(match[1].trim().replace(/\s+/g, ' ').toLowerCase())
    if (def) references.add(def)
  }
  return parseMarkdown(references.size ? source + '\n\n' + [...references].join('\n') : source)
}
