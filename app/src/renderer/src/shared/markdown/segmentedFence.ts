import { parseOpeningFence, isClosingFence } from './markdownBlocks'

export interface FenceBounds {
  start: number
  end: number
  bodyStart: number
  bodyEnd: number
  indent: number
  lang?: string
}

// Called while indexing in the worker, before physical document registrations.
// A shorter matching-looking fence or a fenced string inside a container is not a boundary.
export function leadingFence(source: string, start: number, end: number): FenceBounds | undefined {
  if (!/^ {0,3}(?:`{3,}|~{3,})/.test(source.slice(start, start + 7))) return
  const breaks = /\r\n|[\r\n]/g
  breaks.lastIndex = start
  const first = breaks.exec(source)
  if (!first || first.index >= end) return
  const opening = parseOpeningFence(source.slice(start, first.index))
  if (!opening) return
  const bodyStart = breaks.lastIndex
  let bodyEnd = end
  let lineStart = bodyStart
  while (lineStart < end) {
    const next = breaks.exec(source)
    const lineEnd = next ? Math.min(end, next.index) : end
    if (isClosingFence(source.slice(lineStart, lineEnd), opening)) {
      const after = Math.min(end, next ? breaks.lastIndex : lineEnd)
      if (/\S/.test(source.slice(after, end))) end = after
      bodyEnd = lineStart
      break
    }
    if (!next || next.index >= end) break
    lineStart = breaks.lastIndex
  }
  if (bodyEnd > bodyStart && source[bodyEnd - 1] === '\n') {
    bodyEnd--
    if (bodyEnd > bodyStart && source[bodyEnd - 1] === '\r') bodyEnd--
  } else if (bodyEnd > bodyStart && source[bodyEnd - 1] === '\r') bodyEnd--
  return { start, end, bodyStart, bodyEnd, indent: opening.indent, lang: opening.lang }
}

export function topLevelFence(source: string, start: number, end: number): FenceBounds | undefined {
  const fence = leadingFence(source, start, end)
  return fence?.end === end ? fence : undefined
}
