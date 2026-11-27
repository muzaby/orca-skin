import type { ComputeResults } from './protocol'

export interface CodeIndex {
  text: string
  starts: Uint32Array
  chars: Uint32Array
  widthColumns: number
}
export function displayColumns(text: string): number {
  let width = 0
  for (const char of text) {
    const cp = char.codePointAt(0)!
    if (char === '\t') width += 8 - (width % 8)
    else if (
      cp >= 0x1100 &&
      (cp <= 0x115f ||
        (cp >= 0x2e80 && cp <= 0xa4cf) ||
        (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe10 && cp <= 0xfe6f) ||
        (cp >= 0xff01 && cp <= 0xff60) ||
        (cp >= 0x1f300 && cp <= 0x1faff) ||
        cp >= 0x20000)
    )
      width += 2
    else width++
  }
  return width
}
export function buildCodeIndex(text: string): CodeIndex {
  const starts: number[] = []
  const chars: number[] = [0]
  let start = 0,
    widthColumns = 0
  while (true) {
    const newline = text.indexOf('\n', start)
    let end = newline < 0 ? text.length : newline
    if (newline >= 0 && end > start && text[end - 1] === '\r') end--
    starts.push(start)
    widthColumns = Math.max(widthColumns, displayColumns(text.slice(start, end)))
    chars.push(chars[chars.length - 1] + end - start)
    if (newline < 0) break
    start = newline + 1
  }
  return { text, widthColumns, starts: Uint32Array.from(starts), chars: Uint32Array.from(chars) }
}
export function codeWindow(
  index: CodeIndex,
  start: number,
  end: number
): ComputeResults['codeView'] {
  const { text, starts, chars, widthColumns } = index
  const lineCount = starts.length
  const lines: string[] = []
  for (let i = start; i < Math.min(end, lineCount); i++)
    lines.push(text.slice(starts[i], starts[i] + chars[i + 1] - chars[i]))
  return {
    lineCount,
    widthColumns,
    textChars: chars[lineCount],
    charsBefore: chars[Math.min(start, lineCount)],
    lines
  }
}
