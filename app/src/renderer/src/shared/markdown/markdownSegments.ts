import { MARKDOWN_DOC_SEGMENT_MAX_CHARS } from '../compute/limits'
import { markdownDocumentBlocks, type DocumentBlock } from './markdownDocumentBlocks'

export interface MarkdownSegmentRange {
  start: number
  end: number
  blocks: DocumentBlock[]
}

// Keep neighbouring blocks in one document so ordinary cross-block references still resolve.
// For an oversized single block, cut at its last complete line, then at a character boundary.
export function markdownLayout(source: string): MarkdownSegmentRange[] {
  const segments: MarkdownSegmentRange[] = []
  let start = 0
  let blocks: DocumentBlock[] = []
  function finish(end: number): void {
    if (blocks.length) segments.push({ start, end, blocks })
    start = end
    blocks = []
  }
  for (const block of markdownDocumentBlocks(source)) {
    if (block.end - start > MARKDOWN_DOC_SEGMENT_MAX_CHARS && blocks.length) finish(block.start)
    while (block.end - start > MARKDOWN_DOC_SEGMENT_MAX_CHARS) {
      let end = start + MARKDOWN_DOC_SEGMENT_MAX_CHARS
      const newline = source.slice(start, end).lastIndexOf('\n')
      if (newline >= 0) end = start + newline + 1
      else if (/[\uD800-\uDBFF]/.test(source[end - 1]) && /[\uDC00-\uDFFF]/.test(source[end])) end--
      blocks.push({ start: 0, end: end - start })
      finish(end)
    }
    blocks.push({
      start: Math.max(0, block.start - start),
      end: block.end - start,
      ...(block.table &&
        block.start >= start && {
          table: block.table.map(({ headerEnd, rows }) => ({
            headerEnd: headerEnd - start,
            rows: [rows[0] - start, rows[1] - start] as const
          }))
        })
    })
  }
  finish(source.length)
  return segments
}

export interface MarkdownSegment extends MarkdownSegmentRange {
  text: string
}

export function markdownSegments(
  source: string,
  layout = markdownLayout(source)
): MarkdownSegment[] {
  return layout.map((range) => ({ ...range, text: source.slice(range.start, range.end) }))
}
