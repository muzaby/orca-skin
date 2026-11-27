import { parseFenceRange } from './fenceRange'
import { collectDefinitions } from './markdownDefinitions'
import { usedDefinitions } from './usedDefinitions'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import type { Root, RootContent } from 'hast'
import { safeHast } from './safeHast'
import { applyFootnoteReferences } from './markdownFootnotes'
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

export function parseMarkdown(
  source: string,
  definitionLines: readonly string[] = []
): ComputeResults['markdown'] {
  const prefix = ordinaryPrefix(source)
  const standIn = prefix && source.slice(prefix).trim() ? 'x ' : 'x'
  const input = prefix ? standIn + source.slice(prefix) : source
  // Definitions are invisible in HTML. Prepending the document's first definitions
  // preserves CommonMark precedence even when a later registration redefines a label.
  const header = definitionLines.length ? definitionLines.join('\n') + '\n\n' : ''
  const headerLines = definitionLines.length ? definitionLines.length + 1 : 0
  const tree = parser.parse(header + input)
  if (header) {
    const positions = new WeakSet<object>()
    const nodes: import('mdast').Nodes[] = [tree]
    while (nodes.length) {
      const node = nodes.pop()!
      if ('children' in node) for (const child of node.children) nodes.push(child)
      if (!node.position) continue
      for (const point of [node.position.start, node.position.end]) {
        if (positions.has(point)) continue
        positions.add(point)
        if (point.offset !== undefined) point.offset = Math.max(0, point.offset - header.length)
        point.line = Math.max(1, point.line - headerLines)
      }
    }
  }
  const hast = parser.runSync(tree) as Root
  if (prefix) {
    const paragraph = hast.children[0]
    const lead = paragraph?.type === 'element' ? paragraph.children[0] : undefined
    if (lead?.type === 'text')
      lead.value = source.slice(0, prefix) + lead.value.slice(standIn.length)
  }
  const shifted = new WeakSet<object>()
  safeHast(hast, (node) => {
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
  })
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
  if (request.fence) return { hast: parseFenceRange(doc.text.slice(start, end), request.fence) }
  const source = table
    ? doc.text.slice(start, table.headerEnd) + doc.text.slice(...table.rows)
    : doc.text.slice(start, end)
  const parseBlock = (text: string): ComputeResults['markdown'] => {
    let references: string[] = []
    if (
      text.includes('[') &&
      (request.definitions || start !== 0 || end !== doc.text.length || table)
    ) {
      doc.definitions ??= request.definitions
        ? new Map(request.definitions)
        : collectDefinitions(doc.text)
      references = usedDefinitions(text, doc.definitions).map(([, line]) => line)
    }
    const result = parseMarkdown(text, [...references, ...(request.footnotes?.lines ?? [])])
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
  const result = parseBlock(source)
  if (request.footnotes) applyFootnoteReferences(result.hast, request.footnotes)
  return result
}
