import { expect, it } from 'vitest'
import { buildDiffHunks, expandGap, revealDiffHunkLine } from './diffHunks'
import type { DiffLine } from './diffModel'
import { hunksToDiffLines } from './diffModel'
import {
  buildCounterparts,
  buildDiffView,
  diffViewRows,
  diffViewContext,
  diffViewLocate
} from './diffView'

// Reference from the inline renderer before indexing.
function counterpartOf(lines: readonly DiffLine[], sourceIndex: number): DiffLine | null {
  const line = lines[sourceIndex]
  if (!line || line.type === 'unchanged') return null
  if (line.type === 'removed') {
    let start = sourceIndex
    while (start > 0 && lines[start - 1]?.type === 'removed') start -= 1
    let end = sourceIndex
    while (end + 1 < lines.length && lines[end + 1]?.type === 'removed') end += 1
    const offset = sourceIndex - start
    const candidate = lines[end + 1 + offset]
    return candidate?.type === 'added' && lines[end + 1]?.type === 'added' ? candidate : null
  }
  let start = sourceIndex
  while (start > 0 && lines[start - 1]?.type === 'added') start -= 1
  const offset = sourceIndex - start
  const removedEnd = start - 1
  if (lines[removedEnd]?.type !== 'removed') return null
  let removedStart = removedEnd
  while (removedStart > 0 && lines[removedStart - 1]?.type === 'removed') removedStart -= 1
  const candidate = lines[removedStart + offset]
  return candidate?.type === 'removed' ? candidate : null
}

const types = ['added', 'unchanged', 'removed'] as const
function compare(kinds: readonly DiffLine['type'][]): void {
  const lines = kinds.map((type, index) => ({
    type,
    lineNo: index,
    text: String(index),
    newLine: null,
    oldLine: null
  }))
  const expected = lines.map((_, index) => counterpartOf(lines, index)?.lineNo ?? -1)
  const actual = buildCounterparts(lines)
  if (
    expected.some((partner, index) => partner !== actual[index]) ||
    actual.length !== expected.length
  )
    expect([...actual]).toEqual(expected)
}

it('cp1 matches the previous lookup across all short runs and seeded mixed files', () => {
  for (let length = 0; length <= 8; length++) {
    for (let seed = 0; seed < 3 ** length; seed++)
      compare(Array.from({ length }, (_, i) => types[Math.floor(seed / 3 ** i) % 3]))
  }
  let seed = 42
  const next = (): number => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)
  for (let i = 0; i < 10000; i++)
    compare(Array.from({ length: 9 + (next() % 64) }, () => types[next() % 3]))
})

it('cp2 reads at most four times the line count on a 50,000-line added run', () => {
  const line: DiffLine = { type: 'added', text: 'added', lineNo: 1, newLine: 1, oldLine: null }
  let reads = 0
  const lines = new Proxy(Array<DiffLine>(50000).fill(line), {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads++
      return Reflect.get(target, key, receiver)
    }
  })
  expect(buildCounterparts(lines).every((index) => index === -1)).toBe(true)
  expect(reads).toBeGreaterThan(0)
  expect(reads).toBeLessThanOrEqual(4 * lines.length)
})

const inline = {
  layout: 'inline' as const,
  ignoreWhitespace: false,
  highlightWords: true,
  expansions: []
}
it.each([
  ['p1', 'a\tb', 9],
  ['p2', '한글', 4],
  ['p3', 'x\nlonger\ny', 6]
] as const)('%s stable maximum column width', (_, text, width) => {
  const model = buildDiffView(hunksToDiffLines([{ value: text, added: true }]), false)
  expect(diffViewRows(model, inline, 1, 2).summary.widthColumns).toBe(width)
  expect(diffViewRows(model, inline, 0, 1).summary.widthColumns).toBe(width)
})
it('sb1 pairs corresponding offsets only within each changed run', () => {
  const model = buildDiffView(
    hunksToDiffLines([
      { value: 'a\nb\n', removed: true },
      { value: 'c\n', added: true },
      { value: 'same\n' },
      { value: 'z', added: true }
    ]),
    false
  )
  const rows = diffViewRows(model, { ...inline, layout: 'side-by-side' }, 0, 10).rows
  expect(
    rows.map((r) => (r.kind === 'pair' ? [r.left?.line.text, r.right?.line.text] : r.kind))
  ).toEqual([
    ['a', 'c'],
    ['b', undefined],
    ['same', 'same'],
    [undefined, 'z']
  ])
})
it('lc2 preserves requested positions and duplicates', () => {
  const model = buildDiffView(hunksToDiffLines([{ value: 'a\nb\nc', added: true }]), false)
  const result = diffViewLocate(
    model,
    inline,
    [2, 1, 2, 4].map((newLine) => ({ newLine, oldLine: null }))
  )
  expect(result).toEqual({ lineIndex: [1, 0, 1, -1], rowIndex: [1, 0, 1, -1] })
})
it('cx1 includes bounded context and the prior number on each side', () => {
  const lines = hunksToDiffLines([
      { value: 'context\n'.repeat(15) },
      { value: 'old\n', removed: true },
      { value: 'new', added: true }
    ]),
    model = buildDiffView(lines, false)
  expect(diffViewContext(model, 15)).toEqual({
    lines: lines.slice(12),
    offset: 3,
    oldBefore: 12,
    newBefore: 12
  })
  expect(diffViewContext(model, 0)).toEqual({
    lines: lines.slice(0, 4),
    offset: 0,
    oldBefore: null,
    newBefore: null
  })
})

it('hx1 replays 1000 seeded sequences of gap expansion and hidden-line reveals', () => {
  let seed = 7301
  const next = (limit: number): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return Math.floor((seed / 0x100000000) * limit)
  }
  for (let sample = 0; sample < 1000; sample++) {
    let oldNumber = 0
    const lines = Array.from({ length: 30 + next(51) }, (_, i): DiffLine => {
      const type = next(14) === 0 ? 'added' : 'unchanged'
      return {
        type,
        lineNo: i + 1,
        oldLine: type === 'added' ? null : ++oldNumber,
        newLine: i + 1,
        text: String(i)
      }
    })
    const model = buildDiffView(lines, false)
    let reference = buildDiffHunks(lines, 3)
    const expansions: [number, number][] = []
    for (let step = 0; step < 6; step++) {
      const rows = diffViewRows(model, { ...inline, expansions }, 0, lines.length + 1).rows
      expect(rows.map((r) => (r.kind === 'gap' ? r : r.id))).toEqual(
        reference.rows.map((r) => (r.kind === 'gap' ? r : r.id))
      )
      const gaps = reference.rows.filter((r) => r.kind === 'gap')
      if (!gaps.length) break
      const gap = gaps[next(gaps.length)]
      if (next(3) === 0) {
        const index = gap.start + next(gap.end - gap.start)
        reference = revealDiffHunkLine(reference, index, 3)
        expansions.push([Math.max(gap.start, index - 3), Math.min(gap.end, index + 4)])
      } else {
        const up = gap.canUp && (!gap.canDown || next(2) === 0)
        const count = 1 + next(10)
        const range: [number, number] = up
          ? [Math.max(gap.start, gap.end - count), gap.end]
          : [gap.start, Math.min(gap.start + count, gap.end)]
        const result = expandGap(reference, gap.id, count, up ? 'up' : 'down')
        expect(result.insertedAbove).toBe(up ? range[1] - range[0] : 0)
        reference = result.state
        expansions.push(range)
      }
    }
  }
})
