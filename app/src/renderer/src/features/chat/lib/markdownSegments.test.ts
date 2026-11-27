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
