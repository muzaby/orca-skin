import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import type { FootnoteDefinition, FootnoteReference, Root as MdRoot, Nodes } from 'mdast'
import type { Element, Root, RootContent } from 'hast'
import type { FootnoteBlock } from '../protocol'
import type { MarkdownSegmentRange } from '../../markdown/markdownSegments'
import type { DocumentBlock } from '../../markdown/markdownDocumentBlocks'
import { safeHast } from './safeHast'
import { usedDefinitions } from './usedDefinitions'

const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })

interface Candidate {
  text: string
  start: number
  block: DocumentBlock
}

function walk(node: Nodes, visit: (n: Nodes) => boolean | void): void {
  const pending = [node]
  while (pending.length) {
    const next = pending.pop()!
    if (visit(next) === false || !('children' in next)) continue
    for (let i = next.children.length - 1; i >= 0; i--) pending.push(next.children[i])
  }
}

function globalOffsets(
  node: Nodes,
  offset: number,
  line: number,
  column: number,
  seen: WeakSet<object>
): void {
  walk(node, (entry) => {
    if (!entry.position) return
    for (const point of [entry.position.start, entry.position.end]) {
      if (point.offset !== undefined && !seen.has(point)) {
        point.offset += offset
        if (point.line === 1) point.column += column - 1
        point.line += line - 1
        seen.add(point)
      }
    }
  })
}

function links(root: Root | Element, visit: (link: Element) => void): void {
  const pending: (Root | RootContent)[] = [root]
  while (pending.length) {
    const node = pending.pop()!
    if (node.type === 'element' && node.properties.dataFootnoteRef) visit(node)
    if ('children' in node)
      for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i])
  }
}

// Parse only lexical candidates in their registered block. GFM needs the definition
// to recognize a reference; a hidden stub enables its own escaping/code rules.
export function indexFootnotes(
  source: string,
  layout: MarkdownSegmentRange[],
  regularDefinitions: ReadonlyMap<string, string>
): void {
  const candidates: Candidate[] = []
  const labels = new Map<string, string>()
  for (const segment of layout)
    for (const block of segment.blocks) {
      if (block.fence) continue
      const start = segment.start + block.start
      const text = source.slice(start, segment.start + block.end)
      if (!text.includes('[^')) continue
      candidates.push({ block, start, text })
      if (!text.includes(']:')) continue
      walk(parser.parse(text), (node) => {
        if (node.type === 'footnoteDefinition' && !labels.has('^' + node.identifier))
          labels.set('^' + node.identifier, '[^' + (node.label ?? node.identifier) + ']: x')
      })
    }
  if (!labels.size) return
  const definitions = new Map<string, FootnoteDefinition>()
  const refs: FootnoteReference[] = []
  const owners = new Map<number, { start: number; block: FootnoteBlock }>()
  const usedOrdinary = new Map<string, string>()
  const breaks = /\r\n|[\n\r]/g
  let nextBreak = breaks.exec(source)
  let line = 1,
    lineStart = 0
  for (const { text, start, block } of candidates) {
    while (nextBreak && breaks.lastIndex <= start) {
      line++
      lineStart = breaks.lastIndex
      nextBreak = breaks.exec(source)
    }
    const lines = usedDefinitions(text, labels).map(([, line]) => line)
    if (!lines.length) continue
    const ordinary = usedDefinitions(text, regularDefinitions)
    for (const [id, line] of ordinary) usedOrdinary.set(id, line)
    const context: FootnoteBlock = { lines, refs: [] }
    block.footnotes = context
    const header = [...lines, ...ordinary.map(([, line]) => line)].join('\n')
    const positions = new WeakSet<object>()
    const tree = parser.parse(text + '\n\n' + header)
    for (const child of tree.children) {
      if ((child.position?.start.offset ?? text.length) >= text.length) break
      globalOffsets(child, start, line, start - lineStart + 1, positions)
      walk(child, (node) => {
        if (node.type === 'footnoteDefinition') {
          if (!definitions.has(node.identifier)) definitions.set(node.identifier, node)
          return false
        }
        if (node.type === 'footnoteReference') {
          refs.push(node)
          owners.set(node.position!.start.offset!, { start, block: context })
        }
        return true
      })
    }
  }
  if (!refs.length) return
  const ordinary = parser.parse([...usedOrdinary.values()].join('\n')).children
  const document: MdRoot = {
    type: 'root',
    children: [{ type: 'paragraph', children: refs }, ...definitions.values(), ...ordinary]
  }
  const tree = parser.runSync(document) as Root
  safeHast(tree)
  const calls = tree.children[0]
  if (calls?.type === 'element')
    links(calls, (link) => {
      const offset = link.position!.start.offset!
      const owner = owners.get(offset)!
      const number = link.children[0]
      if (number.type === 'text')
        owner.block.refs.push([offset - owner.start, String(link.properties.id), number.value])
    })
  const footer = tree.children.find(
    (node) => node.type === 'element' && node.properties.dataFootnotes
  )
  if (footer) layout[layout.length - 1].footnoteFooter = { type: 'root', children: [footer] }
}

// Local GFM supplies the original source positions and href. The canonical document
// supplies global numbering, unique repeated-reference ids and exactly one footer.
export function applyFootnoteReferences(tree: Root, context: FootnoteBlock): void {
  tree.children = tree.children.filter((n) => n.type !== 'element' || !n.properties.dataFootnotes)
  const byOffset = new Map(context.refs.map(([offset, id, number]) => [offset, { id, number }]))
  links(tree, (link) => {
    const match = byOffset.get(link.position!.start.offset!)
    if (!match) return
    link.properties.id = match.id
    link.children = [{ type: 'text', value: match.number, position: link.position }]
  })
}
