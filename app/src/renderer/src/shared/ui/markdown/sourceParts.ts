import { decodeString } from 'micromark-util-decode-string'
import type { Element, ElementContent, Root, RootContent, Text } from 'hast'

export interface MarkdownSourcePart {
  readonly start: number
  readonly key: string
}

export interface MarkedText {
  readonly key: string
  readonly text: string
}

/** Index of the last part starting at or before a source offset. */
function partAtOffset(parts: readonly MarkdownSourcePart[], offset: number): number {
  let lo = 0
  let hi = parts.length
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2)
    if (parts[mid].start <= offset) lo = mid + 1
    else hi = mid
  }
  return lo - 1
}

/** A rendered word may cross part boundaries inside a link, emphasis or code span. */
export function markSourceText(
  value: string,
  source: string,
  start: number,
  end: number,
  parts: readonly MarkdownSourcePart[],
  mode: 'literal' | 'markdown' | 'inlineCode' = 'literal'
): MarkedText[] {
  if (!parts.length) return []
  let partIndex = Math.max(0, partAtOffset(parts, start))
  if (parts[partIndex + 1]?.start === undefined || parts[partIndex + 1].start >= end) {
    return [{ key: parts[partIndex].key, text: value }]
  }

  if (mode === 'inlineCode') {
    // HAST includes both backtick delimiters in the text node's source position.
    let bodyStart = start
    while (bodyStart < end && source[bodyStart] === '`') bodyStart++
    end -= bodyStart - start
    start = bodyStart
  }
  const raw = source.slice(start, end)
  // For ordinary prose use CommonMark's decoded token and its original position.
  // One reference can produce multiple UTF-16 units, all owned by its opening part.
  const decodedOffsets: number[] = []
  if (mode === 'inlineCode') {
    // CommonMark treats each line ending as one space and strips one padding space
    // at each end unless the span consists entirely of spaces.
    const normalized = raw.replace(/\r\n?|\n/g, ' ')
    const padded = normalized.startsWith(' ') && normalized.endsWith(' ') && /[^ ]/.test(normalized)
    if ((padded ? normalized.slice(1, -1) : normalized) === value) {
      for (let i = 0; i < raw.length; i++) {
        decodedOffsets.push(start + i)
        if (raw[i] === '\r' && raw[i + 1] === '\n') i++
      }
      if (padded) {
        decodedOffsets.shift()
        decodedOffsets.pop()
      }
    }
  } else if (mode === 'markdown' && /[&\\]/.test(raw)) {
    const tokenPattern = /&(?:#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});|\\[!-~]|[\s\S]/gi
    let decoded = ''
    for (const match of raw.matchAll(tokenPattern)) {
      const token = match[0].length > 1 ? decodeString(match[0]) : match[0]
      decoded += token
      for (let unit = 0; unit < token.length; unit++) {
        decodedOffsets.push(start + match.index + (token === match[0] ? unit : 0))
      }
    }
    if (decoded !== value) decodedOffsets.length = 0
  }
  const exactStart = raw.indexOf(value)
  const exact = exactStart >= 0
  const output: MarkedText[] = []
  let sourceOffset = exact ? start + exactStart : start
  let runStart = 0
  for (let offset = 0; offset < value.length; offset++) {
    if (decodedOffsets.length) sourceOffset = decodedOffsets[offset]
    else if (!exact) {
      // Markdown can remove delimiters, escapes and indentation. Keep each surviving
      // character within this AST node's source interval.
      if (source[sourceOffset] !== value[offset]) {
        const lookahead = source.slice(sourceOffset, Math.min(end, sourceOffset + 80))
        const next = lookahead.indexOf(value[offset])
        if (next >= 0) sourceOffset += next
      }
    }
    let nextPart = partIndex
    while (parts[nextPart + 1] && parts[nextPart + 1].start <= sourceOffset) nextPart++
    if (nextPart !== partIndex) {
      if (offset > runStart)
        output.push({ key: parts[partIndex].key, text: value.slice(runStart, offset) })
      runStart = offset
      partIndex = nextPart
    }
    sourceOffset++
  }
  if (runStart < value.length)
    output.push({ key: parts[partIndex].key, text: value.slice(runStart) })
  return output
}

export function sourcePartSpans(
  source: string,
  parts: readonly MarkdownSourcePart[]
): () => (tree: Root) => void {
  function transform(node: RootContent, decodeMarkdown = true): RootContent[] {
    if (node.type === 'element') {
      if (node.tagName === 'pre') return [node]
      node.children = node.children.flatMap((child) =>
        transform(child, node.tagName !== 'code')
      ) as ElementContent[]
    }
    if (node.type !== 'text') return [node]
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined || node.value === '') return [node]

    return markSourceText(
      node.value,
      source,
      start,
      end,
      parts,
      decodeMarkdown ? 'markdown' : 'inlineCode'
    ).map((run): Element => ({
      type: 'element',
      tagName: 'span',
      properties: { dataPartKey: run.key, dataMarkdownPartFragment: '' },
      children: [{ type: 'text', value: run.text } satisfies Text]
    }))
  }

  return () => (tree) => {
    tree.children = tree.children.flatMap((child) => transform(child))
  }
}

export function sliceSourceParts(
  parts: readonly MarkdownSourcePart[] | undefined,
  start: number,
  end: number
): readonly MarkdownSourcePart[] | undefined {
  if (!parts?.length) return undefined
  const first = partAtOffset(parts, start)
  const next: MarkdownSourcePart[] = []
  if (first >= 0) next.push({ key: parts[first].key, start: 0 })
  for (let index = first + 1; index < parts.length && parts[index].start < end; index++) {
    next.push({ key: parts[index].key, start: parts[index].start - start })
  }
  return next.length ? next : undefined
}
