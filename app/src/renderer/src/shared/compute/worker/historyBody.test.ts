import { expect, it } from 'vitest'
import { HISTORY_BODY_BYTES } from '../../../../../shared/history-page'
import { decodeHistoryBody } from './historyBody'

it('AC14 decodes a 4 MiB body across 64 KiB boundaries inside the compute worker', () => {
  const parts = [{ type: 'text', text: '한'.repeat(1_400_000) }]
  const buffer = Buffer.from(JSON.stringify(parts))
  let result: ReturnType<typeof decodeHistoryBody> | undefined
  for (let offset = 0; offset < buffer.length; offset += HISTORY_BODY_BYTES) {
    const bytes = buffer.subarray(offset, offset + HISTORY_BODY_BYTES)
    result = decodeHistoryBody({
      kind: 'historyBody',
      sequence: 1,
      bytes: buffer.length,
      packet: { offset, base64: bytes.toString('base64') }
    })
    expect(result.nextOffset).toBe(offset + bytes.length)
    if (result.nextOffset < buffer.length) expect(result.parts).toEqual([])
  }
  expect(result?.parts).toEqual(parts)
  expect(result?.layouts?.[0].segments.at(-1)?.end).toBe(parts[0].text.length)
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
      packet: { offset: 0, base64: chunk.toString('base64') }
    })
  ).toThrow()
})

it('discards an interrupted stream and rejects a packet from a different generation or offset', () => {
  const head = {
    kind: 'historyBody' as const,
    bytes: 2,
    sequence: 9,
    packet: { offset: 0, base64: 'Ww==' }
  }
  expect(decodeHistoryBody(head).nextOffset).toBe(1)
  const tail = { ...head, packet: { offset: 1, base64: 'XQ==' } }
  expect(() => decodeHistoryBody({ ...tail, sequence: 10 })).toThrow('range')
  decodeHistoryBody({ ...head, packet: null })
  expect(() => decodeHistoryBody(tail)).toThrow('range')
})
