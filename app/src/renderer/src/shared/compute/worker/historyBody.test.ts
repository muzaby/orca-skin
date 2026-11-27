import { expect, it } from 'vitest'
import { HISTORY_BODY_BYTES } from '../../../../../shared/history-page'
import type { HistoryBodyRequest } from '../protocol'
import { decodeHistoryBody } from './historyBody'

it('AC14 decodes a 4 MiB body across 64 KiB boundaries inside the compute worker', () => {
  const parts = [{ type: 'text', text: '한'.repeat(1_400_000) }]
  const buffer = Buffer.from(JSON.stringify(parts))
  const chunks: HistoryBodyRequest['chunks'] = []
  for (let offset = 0; offset < buffer.length; offset += HISTORY_BODY_BYTES) {
    const bytes = buffer.subarray(offset, offset + HISTORY_BODY_BYTES)
    chunks.push({ base64: bytes.toString('base64'), bytes: bytes.length })
  }
  expect(
    decodeHistoryBody({ kind: 'historyBody', sequence: 1, bytes: buffer.length, chunks }).parts
  ).toEqual(parts)
})
it.each([
  ['truncated UTF-8', Buffer.from([0xe1, 0x80]), 2],
  ['wrong number of bytes', Buffer.from('[]'), 1],
  ['missing part type', Buffer.from('[{}]'), 4],
  ['empty part type', Buffer.from('[{"type":""}]'), 13]
])('rejects %s', (_label, data, bytes) => {
  const chunk = data as Buffer
  expect(() =>
    decodeHistoryBody({
      kind: 'historyBody',
      sequence: 1,
      bytes: Number(bytes),
      chunks: [{ base64: chunk.toString('base64'), bytes: Number(bytes) }]
    })
  ).toThrow()
})
