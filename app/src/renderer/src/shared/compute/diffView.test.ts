import { expect, it } from 'vitest'
import type { DiffLine } from './diffModel'
import { buildCounterparts } from './diffView'

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
