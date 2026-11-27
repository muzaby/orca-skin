import { docKey, type DocRef } from './protocol'
import type { DiffLine } from './diffModel'
export type DiffSourceRef =
  { kind: 'lines' | 'patch'; doc: DocRef } | { kind: 'pair'; old: DocRef; new: DocRef }
export interface AxisRef {
  source: DiffSourceRef
  ignoreWhitespace: boolean
  axis: 'old' | 'new'
}
export interface LineNumbers {
  oldLine: Int32Array
  newLine: Int32Array
}
export interface DiffOptions {
  ignoreWhitespace: boolean
  layout: 'inline' | 'side-by-side'
  highlightWords: boolean
  expansions: readonly (readonly [number, number])[]
}
export const diffSourceKey = (s: DiffSourceRef): string =>
  JSON.stringify(
    s.kind === 'pair' ? [s.kind, docKey(s.old), docKey(s.new)] : [s.kind, docKey(s.doc)]
  )
export const diffSourceDocs = (s: DiffSourceRef): DocRef[] =>
  s.kind === 'pair' ? [s.old, s.new] : [s.doc]
export function packLines(
  lines: readonly Pick<DiffLine, 'type' | 'text' | 'oldLine' | 'newLine'>[]
): { text: string; lines: LineNumbers } {
  const oldLine = new Int32Array(lines.length),
    newLine = new Int32Array(lines.length)
  const text = lines
    .map((line, i) => {
      oldLine[i] = line.oldLine ?? -1
      newLine[i] = line.newLine ?? -1
      return (line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ') + line.text
    })
    .join('\n')
  return { text, lines: { oldLine, newLine } }
}
export function unpackLines(text: string, numbers: LineNumbers): DiffLine[] {
  if (!numbers.oldLine.length) return []
  return text.split('\n').map((value, i) => {
    const oldLine = numbers.oldLine[i] < 0 ? null : numbers.oldLine[i],
      newLine = numbers.newLine[i] < 0 ? null : numbers.newLine[i]
    const type = value.startsWith('+') ? 'added' : value.startsWith('-') ? 'removed' : 'unchanged'
    return {
      type,
      oldLine,
      newLine,
      lineNo: (type === 'removed' ? oldLine : (newLine ?? oldLine)) ?? 0,
      text: value.slice(1)
    }
  })
}
