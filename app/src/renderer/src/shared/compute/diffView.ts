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
