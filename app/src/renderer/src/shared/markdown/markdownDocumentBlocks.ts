import type { FenceBounds } from './segmentedFence'
import { splitStableBlocks } from './markdownBlocks'
import {
  MARKDOWN_TABLE_CHUNK_MAX_CELLS,
  MARKDOWN_TABLE_CHUNK_MAX_CHARS,
  MARKDOWN_TABLE_CHUNK_ROWS
} from '../compute/limits'
import type { TableChunk } from '../compute/protocol'
export interface DocumentBlock {
  start: number
  end: number
  table?: TableChunk[]
  fence?: FenceBounds
}
const list = /^ {0,3}(?:[-+*]|\d{1,9}[.)])\s/m
const quote = /^ {0,3}>/m
function htmlEnd(text: string): RegExp | undefined {
  const first = text.trimStart()
  const tag = /^<(script|pre|style|textarea)(?=\s|>|$)/i.exec(first)
  if (tag) return new RegExp('</' + tag[1] + '>', 'i')
  if (first.startsWith('<!--')) return /-->/
  if (first.startsWith('<?')) return /\?>/
  if (first.startsWith('<![CDATA[')) return /\]\]>/
  if (/^<![A-Z]/.test(first)) return />/
  return undefined
}
function classify(source: string, start: number, end: number): DocumentBlock {
  const block: DocumentBlock = { start, end }
  const body = source.slice(start, end)
  const delimiter = /^[^\n]+\n( {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?)[ \t]*\r?\n/.exec(body)
  if (!delimiter || !delimiter[0].includes('|')) return block
  const cols = delimiter[1]
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|').length
  const headerEnd = start + delimiter[0].length
  const chunks: TableChunk[] = []
  let begin = headerEnd,
    rows = 0
  let pos = headerEnd
  while (pos < end) {
    const newline = source.indexOf('\n', pos)
    const next = newline < 0 ? end : Math.min(end, newline + 1)
    if (!source.slice(pos, next).trim()) break
    if (
      rows &&
      (rows === MARKDOWN_TABLE_CHUNK_ROWS ||
        (rows + 2) * cols > MARKDOWN_TABLE_CHUNK_MAX_CELLS ||
        headerEnd - start + next - begin > MARKDOWN_TABLE_CHUNK_MAX_CHARS)
    ) {
      chunks.push({ headerEnd, rows: [begin, pos] })
      begin = pos
      rows = 0
    }
    rows++
    pos = next
  }
  if (rows) chunks.push({ headerEnd, rows: [begin, pos] })
  if (chunks.length > 1) return { ...block, table: chunks }
  return block
}

export function markdownDocumentBlocks(source: string): DocumentBlock[] {
  const firstFootnote = /^ {0,3}\[\^[^\]]+\]:/m.test(source) ? source.indexOf('[^') : -1
  const terminated = source.endsWith('\n')
  const { stable, tail } = splitStableBlocks(terminated ? source : source + '\n')
  const parts = [...stable, terminated ? tail : tail.slice(0, -1)]
  const ranges: { start: number; end: number }[] = []
  let cursor = 0,
    groupStart = 0,
    previous = '',
    closing: RegExp | undefined
  for (const part of parts) {
    if (!part) continue
    const at = source.indexOf(part, cursor)
    const end = at + part.length
    const next = part.trimStart()
    const join =
      !!closing ||
      /^[ \t]/.test(part) ||
      (list.test(previous) && list.test(next.split('\n', 1)[0])) ||
      (quote.test(previous) && quote.test(next.split('\n', 1)[0])) ||
      (/^</.test(previous.trimStart()) && /^</.test(next))
    if (previous && !join) {
      ranges.push({ start: groupStart, end: at })
      groupStart = at
    }
    if (!closing) closing = htmlEnd(part)
    if (closing?.test(part)) closing = undefined
    previous = part
    cursor = end
  }
  ranges.push({ start: groupStart, end: source.length })
  // All references and definitions share one GFM numbering/backlink context. Fully
  // independent leading blocks can be parsed and painted before that context.
  if (firstFootnote >= 0) {
    const first = ranges.findIndex((range) => range.end > firstFootnote)
    if (first >= 0) {
      const start = ranges[first].start
      ranges.length = first
      ranges.push({ start, end: source.length })
    }
  }
  return ranges.map(({ start, end }) => classify(source, start, end))
}
