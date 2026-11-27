import { expect, it } from 'vitest'
import { MARKDOWN_DOC_SEGMENT_MAX_CHARS } from '../../../shared/compute/limits'
import { markdownSegments } from '../../../shared/markdown/markdownSegments'

it('AC14′ 40M chars register in segments ≤ 8M without losing characters', () => {
  const source = 'a'.repeat(39_999_997) + 'end'
  const segments = markdownSegments(source)
  expect(segments.map((s) => s.start)).toEqual([0, 8e6, 16e6, 24e6, 32e6])
  for (const segment of segments) {
    expect(segment.text.length).toBeLessThanOrEqual(MARKDOWN_DOC_SEGMENT_MAX_CHARS)
    expect(segment.blocks).toEqual([{ start: 0, end: segment.text.length }])
  }
  expect(segments.map((s) => s.text).join('') === source).toBe(true)
})
it('prefers complete blocks, then the last newline, and keeps a surrogate pair intact', () => {
  const limit = MARKDOWN_DOC_SEGMENT_MAX_CHARS
  const head = 'a'.repeat(limit - 12) + '\n\n'
  const source = head + 'next line\n' + 'b'.repeat(limit - 1) + '🦦tail'
  const segments = markdownSegments(source)
  expect(segments.map((s) => s.text.length)).toEqual([head.length, 10, limit - 1, 6])
  expect(segments.at(-1)?.text).toBe('🦦tail')
})
