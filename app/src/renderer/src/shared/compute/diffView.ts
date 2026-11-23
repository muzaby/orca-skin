import type { DiffLine } from './diffModel'

/** Index word-highlight partners once for the whole source, including lines inside folded gaps. */
export function buildCounterparts(lines: readonly DiffLine[]): Int32Array {
  const counterparts = new Int32Array(lines.length).fill(-1)
  let start = 0
  while (start < lines.length) {
    if (lines[start].type !== 'removed') {
      start++
      continue
    }
    let addedStart = start + 1
    while (addedStart < lines.length && lines[addedStart].type === 'removed') addedStart++
    if (lines[addedStart]?.type === 'added') {
      // The existing removed-line rule checks the offset even beyond the first added run.
      for (let index = start; index < addedStart; index++) {
        const partner = addedStart + (index - start)
        if (lines[partner]?.type === 'added') counterparts[index] = partner
      }
      for (let offset = 0; offset < addedStart - start; offset++) {
        const index = addedStart + offset
        if (lines[index]?.type !== 'added') break
        counterparts[index] = start + offset
      }
    }
    start = addedStart
  }
  return counterparts
}

import {
  collapseWhitespaceOnlyChanges,
  toSideBySideRows,
  changedWordSpan,
  type WordSpan
} from './diffDisplay'
import { buildDiffHunks, type DiffHunkGapRow } from './diffHunks'
import { displayColumns } from './codeView'
import type { DiffOptions } from './diffSource'

export interface DiffCell {
  sourceIndex: number
  line: DiffLine
  oldAxis: number
  newAxis: number
  wordSpan: WordSpan | null
}
export type DiffViewRow =
  | ({ kind: 'line'; id: string } & DiffCell)
  | DiffHunkGapRow
  | { kind: 'pair'; id: string; left: DiffCell | null; right: DiffCell | null }
interface PairSlot {
  kind: 'pair'
  left: number
  right: number
}
type Slot = number | DiffHunkGapRow | PairSlot
interface Layout {
  slots: Slot[]
  positions: Int32Array
  chars: Float64Array
}
export interface DiffModel {
  lines: readonly DiffLine[]
  counterparts: Int32Array
  oldAxis: Int32Array
  newAxis: Int32Array
  oldLocations: Map<number, number>
  newLocations: Map<number, number>
  added: number
  removed: number
  widthColumns: number
  layout?: { key: string; value: Layout }
}
export function buildDiffView(input: readonly DiffLine[], ignoreWhitespace: boolean): DiffModel {
  const lines = ignoreWhitespace ? collapseWhitespaceOnlyChanges(input) : input
  const oldAxis = new Int32Array(lines.length).fill(-1),
    newAxis = new Int32Array(lines.length).fill(-1)
  const oldLocations = new Map<number, number>(),
    newLocations = new Map<number, number>()
  let old = 0,
    next = 0,
    added = 0,
    removed = 0,
    widthColumns = 0
  lines.forEach((line, i) => {
    if (line.type !== 'added') oldAxis[i] = old++
    if (line.type !== 'removed') newAxis[i] = next++
    if (line.oldLine !== null && !oldLocations.has(line.oldLine)) oldLocations.set(line.oldLine, i)
    if (line.newLine !== null && !newLocations.has(line.newLine)) newLocations.set(line.newLine, i)
    if (line.type === 'added') added++
    if (line.type === 'removed') removed++
    widthColumns = Math.max(widthColumns, displayColumns(line.text))
  })
  return {
    lines,
    counterparts: buildCounterparts(lines),
    oldAxis,
    newAxis,
    oldLocations,
    newLocations,
    added,
    removed,
    widthColumns
  }
}
function layoutFor(model: DiffModel, options: DiffOptions): Layout {
  const key = JSON.stringify([options.layout, options.expansions])
  if (model.layout?.key === key) return model.layout.value
  const { lines } = model
  const slots: Slot[] = []
  const base = buildDiffHunks(lines, 3)
  const ranges = [...options.expansions].sort((a, b) => a[0] - b[0])
  let run: number[] = []
  const flush = (): void => {
    if (options.layout === 'inline') {
      for (const i of run) slots.push(i)
    } else if (run.length) {
      const index = new Map(run.map((i) => [lines[i], i]))
      for (const pair of toSideBySideRows(run.map((i) => lines[i])))
        slots.push({
          kind: 'pair',
          left: pair.left ? index.get(pair.left)! : -1,
          right: pair.right ? index.get(pair.right)! : -1
        })
    }
    run = []
  }
  const gap = (start: number, end: number): void => {
    if (start >= end) return
    flush()
    slots.push({
      kind: 'gap',
      start,
      end,
      id: `gap:${start}:${end}`,
      canUp: end < lines.length,
      canDown: start > 0 || end === lines.length
    })
  }
  for (const row of base.rows) {
    if (row.kind === 'line') {
      run.push(row.sourceIndex)
      continue
    }
    let cursor = row.start
    for (const [a, b] of ranges) {
      if (b <= cursor || a >= row.end) continue
      gap(cursor, Math.max(cursor, a))
      cursor = Math.max(cursor, a)
      while (cursor < Math.min(b, row.end)) run.push(cursor++)
    }
    gap(cursor, row.end)
  }
  flush()
  const positions = new Int32Array(lines.length).fill(-1),
    chars = new Float64Array(slots.length + 1)
  slots.forEach((slot, i) => {
    chars[i + 1] = chars[i]
    const add = (n: number): void => {
      if (n >= 0) {
        positions[n] = i
        chars[i + 1] += lines[n].text.length
      }
    }
    if (typeof slot === 'number') add(slot)
    else if (slot.kind === 'pair') {
      add(slot.left)
      add(slot.right)
    }
  })
  const value = { slots, positions, chars }
  model.layout = { key, value }
  return value
}
export function diffViewRows(
  model: DiffModel,
  options: DiffOptions,
  start: number,
  end: number
): {
  summary: {
    rowCount: number
    lineCount: number
    added: number
    removed: number
    widthColumns: number
    textChars: number
  }
  charsBefore: number
  rows: DiffViewRow[]
} {
  const { slots, chars } = layoutFor(model, options)
  const cell = (n: number, side?: 'old' | 'new', paired?: number): DiffCell => {
    const line = model.lines[n],
      partner = model.lines[paired ?? model.counterparts[n]]
    const old = side ? side === 'old' : line.type === 'removed'
    let wordSpan: WordSpan | null = null
    if (options.highlightWords && partner && partner !== line)
      wordSpan = old
        ? changedWordSpan(line.text, partner.text).old
        : changedWordSpan(partner.text, line.text).new
    return { sourceIndex: n, line, oldAxis: model.oldAxis[n], newAxis: model.newAxis[n], wordSpan }
  }
  const rows: DiffViewRow[] = slots.slice(start, end).map((slot) => {
    if (typeof slot === 'number') return { kind: 'line', id: 'line:' + slot, ...cell(slot) }
    if (slot.kind === 'gap') return slot
    return {
      kind: 'pair',
      id: `pair:${slot.left}:${slot.right}`,
      left: slot.left < 0 ? null : cell(slot.left, 'old', slot.right),
      right: slot.right < 0 ? null : cell(slot.right, 'new', slot.left)
    }
  })
  return {
    summary: {
      rowCount: slots.length,
      lineCount: model.lines.length,
      added: model.added,
      removed: model.removed,
      widthColumns: model.widthColumns,
      textChars: chars[slots.length]
    },
    charsBefore: chars[Math.min(start, slots.length)],
    rows
  }
}
export function diffViewLocate(
  model: DiffModel,
  options: DiffOptions,
  anchors: readonly { oldLine: number | null; newLine: number | null }[]
): { lineIndex: number[]; rowIndex: number[] } {
  const { positions } = layoutFor(model, options)
  const lineIndex = anchors.map(({ oldLine, newLine }) => {
    const i =
      newLine === null
        ? oldLine === null
          ? undefined
          : model.oldLocations.get(oldLine)
        : model.newLocations.get(newLine)
    if (i === undefined || (oldLine !== null && model.lines[i].oldLine !== oldLine)) return -1
    return i
  })
  return { lineIndex, rowIndex: lineIndex.map((i) => positions[i] ?? -1) }
}
export function diffViewContext(
  model: DiffModel,
  index: number
): { lines: DiffLine[]; offset: number; oldBefore: number | null; newBefore: number | null } {
  const start = Math.max(0, index - 3)
  function before(side: 'oldLine' | 'newLine'): number | null {
    for (let i = start - 1; i >= 0; i--)
      if (model.lines[i][side] !== null) return model.lines[i][side]
    return null
  }
  return {
    lines: model.lines.slice(start, index + 4),
    offset: index - start,
    oldBefore: before('oldLine'),
    newBefore: before('newLine')
  }
}
