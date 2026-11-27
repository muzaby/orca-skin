import { expect, it } from 'vitest'
import { portHarness } from '../../../shared/compute/clientPort.testfixture'
import {
  COMPUTE_DOC_MAX_CHARS,
  MARKDOWN_DOC_SEGMENT_MAX_CHARS
} from '../../../shared/compute/limits'
import { markdownSegments } from '../../../shared/markdown/markdownSegments'

it('AC14′ 40M chars register in segments ≤ 8M without losing characters', async () => {
  const source = 'a'.repeat(39_999_997) + 'end'
  const segments = markdownSegments(source)
  const { client, ports } = portHarness(COMPUTE_DOC_MAX_CHARS)
  for (const segment of segments) {
    const lease = client.openDocument(
      { id: 'body:' + segment.start, revision: 1 },
      { text: segment.text },
      'markdown'
    )
    expect(lease.available).toBe(true)
    const work = client.request({
      kind: 'markdown',
      doc: lease.ref,
      start: 0,
      end: segment.text.length
    })
    const port = ports.get('markdown')!
    expect(port.messages.at(-2)).toMatchObject({ type: 'doc.open', ref: lease.ref })
    port.reply()
    await work.promise
    lease.release()
    expect(segment.text.length).toBeLessThanOrEqual(MARKDOWN_DOC_SEGMENT_MAX_CHARS)
    expect(segment.blocks).toEqual([{ start: 0, end: segment.text.length }])
  }
  expect(segments.map((s) => s.start)).toEqual([0, 8e6, 16e6, 24e6, 32e6])
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

it('VP-41 packs thousands of short paragraphs while preserving their source and independent footer', () => {
  const paragraph = 'unique paragraph'.repeat(12)
  const source = (paragraph + '\n\n').repeat(3000) + 'last[^1]\n\n[^1]: footnote'
  const segments = markdownSegments(source)
  const blocks = segments.flatMap((segment) =>
    segment.blocks.map((block) => segment.text.slice(block.start, block.end))
  )
  expect(blocks.length).toBeLessThan(100)
  expect(blocks.join('')).toBe(source)
  expect(blocks.every((block) => block.length <= 16384)).toBe(true)
  expect(
    blocks.flatMap((block) => block.split('\n\n')).filter((item) => item === paragraph)
  ).toHaveLength(3000)
  expect(blocks.at(-1)).toContain('last[^1]\n\n[^1]: footnote')
})
