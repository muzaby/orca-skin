import type { Root, Text } from 'hast'
import type { MarkdownRequest } from '../protocol'

// Source offsets in this request are local to the registered slice. An emitted
// character keeps the part that supplied it, including a tab or a CRLF crossing parts.
export function parseFenceRange(
  source: string,
  fence: NonNullable<MarkdownRequest['fence']>
): Root {
  const children: Text[] = []
  const parts = fence.parts ?? []
  let part = 0
  function append(value: string, at: number): void {
    if (!value) return
    while (part + 1 < parts.length && parts[part + 1].start <= at) part++
    const partKey = parts[part]?.key
    const last = children.at(-1)
    if (last && last.data?.partKey === partKey) last.value += value
    else children.push({ type: 'text', value, ...(partKey !== undefined && { data: { partKey } }) })
  }
  function content(start: number, end: number): void {
    while (start < end) {
      while (part + 1 < parts.length && parts[part + 1].start <= start) part++
      const next = Math.min(end, parts[part + 1]?.start ?? end)
      append(source.slice(start, next), start)
      start = next
    }
  }
  let at = 0
  let lineStart = fence.lineStart
  const breaks = /\r\n|[\r\n]/g
  while (at < source.length) {
    const br = breaks.exec(source)
    const lineEnd = br?.index ?? source.length
    if (lineStart) {
      let indent = 0
      while (indent < fence.indent && at < lineEnd && source[at] === ' ') {
        at++
        indent++
      }
      if (indent < fence.indent && source[at] === '\t') {
        append(' '.repeat(4 - fence.indent), at)
        at++
      }
    }
    content(at, lineEnd)
    if (!br) break
    append('\n', lineEnd)
    at = breaks.lastIndex
    lineStart = true
  }
  return { type: 'root', children }
}
