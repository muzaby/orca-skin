import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import type { Root, RootContent } from 'hast'
import { defaultUrlTransform } from 'react-markdown'
import type { ComputeResults } from '../protocol'

const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })

// A single-line run of letters, digits and spaces has no inline syntax. Tokenizing
// millions of such characters creates transient parser events for every word. Keep
// one leading word and separator to preserve the delimiter context of the suffix.
function ordinaryPrefix(source: string): number {
  if (source.length < 4096 || !/^\p{L}/u.test(source)) return 0
  const line = source.trimEnd()
  if (/[\r\n]/.test(line)) return 0
  const match = /^[\p{L}\p{M}\p{N} ]+/u.exec(line)!
  if (match[0].length === line.length) return line.length
  const cut = match[0].lastIndexOf(' ') + 1
  return cut >= 4096 ? cut : 0
}

export function parseMarkdown(source: string): ComputeResults['markdown'] {
  const prefix = ordinaryPrefix(source)
  const standIn = prefix && source.slice(prefix).trim() ? 'x ' : 'x'
  const input = prefix ? standIn + source.slice(prefix) : source
  const hast = parser.runSync(parser.parse(input)) as Root
  if (prefix) {
    const paragraph = hast.children[0]
    const lead = paragraph?.type === 'element' ? paragraph.children[0] : undefined
    if (lead?.type === 'text')
      lead.value = source.slice(0, prefix) + lead.value.slice(standIn.length)
  }
  const shifted = new WeakSet<object>()
  const pending: (Root | RootContent)[] = [hast]
  while (pending.length) {
    const node = pending.pop()!
    if (prefix && node.position) {
      for (const point of [node.position.start, node.position.end]) {
        // Positions may be shared by adjacent or enclosing nodes.
        if (point.offset !== undefined && point.offset >= standIn.length && !shifted.has(point)) {
          point.offset += prefix - standIn.length
          if (point.line === 1) point.column += prefix - standIn.length
          shifted.add(point)
        }
      }
    }
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
  const parseBlock = (text: string): ComputeResults['markdown'] => {
    const result = parseMarkdown(text)
    if (!table || table.headerEnd === table.rows[0]) return result
    const header = table.headerEnd - start
    const skipped = table.rows[0] - table.headerEnd
    const visited = new WeakSet<object>()
    const pending: (Root | RootContent)[] = [result.hast]
    while (pending.length) {
      const node = pending.pop()!
      if (node.position)
        for (const point of [node.position.start, node.position.end]) {
          if (point.offset !== undefined && point.offset >= header && !visited.has(point)) {
            point.offset += skipped
            visited.add(point)
          }
        }
      if ('children' in node) for (const child of node.children) pending.push(child)
    }
    return result
  }
  if (!source.includes('[') || (start === 0 && end === doc.text.length && !table))
    return parseBlock(source)
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
  return parseBlock(references.size ? source + '\n\n' + [...references].join('\n') : source)
}
