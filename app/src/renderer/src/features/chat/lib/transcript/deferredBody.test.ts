import { installHistoryWorker } from '../../../../shared/compute/historyWorker.testfixture'
import { describe, it, expect, vi } from 'vitest'
import { readDeferredParts } from './deferredBody'
import {
  HISTORY_BODY_BYTES,
  type HistoryBodyRef,
  type HistoryPageReply,
  type HistoryQuery
} from '../../../../../../shared/history-page'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import { newTranscriptChanges } from './changeLog'

installHistoryWorker()

const ref: HistoryBodyRef = {
  kind: 'parts',
  session: 's',
  generation: 'g',
  message: 'middle',
  bytes: 1
}
describe('deferred history bodies', () => {
  it('decodes 4 MiB of Korean text including codepoints split at the 64 KiB boundary', async () => {
    const parts = [{ type: 'text', text: '가'.repeat(1_400_000) }]
    const bytes = Buffer.from(JSON.stringify(parts))
    const body = { ...ref, bytes: bytes.length }
    const offsets: number[] = []
    const page = async (q: HistoryQuery): Promise<HistoryPageReply> => {
      if (q.kind !== 'body') throw Error(q.kind)
      offsets.push(q.offset)
      const block = bytes.subarray(q.offset, q.offset + HISTORY_BODY_BYTES)
      const nextOffset = q.offset + block.length
      return {
        status: 'body',
        sessionId: 's',
        openGeneration: 3,
        requestId: offsets.length,
        offset: q.offset,
        nextOffset,
        done: nextOffset === bytes.length,
        base64: block.toString('base64')
      }
    }
    expect(await readDeferredParts(body, 3, page, () => true)).toEqual(parts)
    expect(offsets).toEqual(
      Array.from(
        { length: Math.ceil(bytes.length / HISTORY_BODY_BYTES) },
        (_, i) => i * HISTORY_BODY_BYTES
      )
    )
    await expect(
      readDeferredParts(
        body,
        3,
        async (q) => ({ ...(await page(q)), sessionId: 't' }),
        () => true
      )
    ).rejects.toThrow()
    await expect(readDeferredParts(body, 4, page, () => true)).rejects.toThrow()
    let active = true
    await expect(
      readDeferredParts(
        body,
        3,
        async (q) => {
          active = false
          return page(q)
        },
        () => active
      )
    ).rejects.toThrow()
  })
  it.each([
    'wrong offset',
    'empty',
    'oversized',
    'wrong advance',
    'invalid part',
    'cancelled after reply',
    'cancelled before publish'
  ] as const)('rejects a deferred body with %s', async (problem) => {
    let text = problem === 'invalid part' ? '[{}]' : '[]'
    if (problem === 'oversized') text = text.padEnd(HISTORY_BODY_BYTES + 1)
    const body = { ...ref, bytes: text.length }
    const page = vi.fn<Parameters<typeof readDeferredParts>[2]>()
    page.mockResolvedValueOnce({
      status: 'body',
      sessionId: 's',
      requestId: 1,
      openGeneration: 3,
      offset: problem === 'wrong offset' ? 1 : 0,
      nextOffset: problem === 'empty' ? 0 : problem === 'wrong advance' ? 1 : text.length,
      done: problem !== 'empty' && problem !== 'wrong advance',
      base64: Buffer.from(problem === 'empty' ? '' : text).toString('base64')
    })
    // A missing progress check must not turn a zero-length chunk into a test timeout.
    page.mockRejectedValue(Error('unexpected second read'))
    const current = vi.fn(() => true)
    if (problem === 'cancelled after reply')
      current.mockReturnValueOnce(true).mockReturnValue(false)
    if (problem === 'cancelled before publish')
      current.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false)
    const error =
      problem === 'cancelled before publish'
        ? 'Incomplete history body'
        : problem === 'wrong offset' || problem === 'cancelled after reply'
          ? 'Stale history body'
          : problem === 'invalid part'
            ? 'Invalid history body'
            : 'Invalid history body range'
    await expect(readDeferredParts(body, 3, page, current)).rejects.toThrow(error)
    expect(page).toHaveBeenCalledTimes(1)
  })
  it.each(['code', 'work', 'opencode'] as const)(
    'shows one stable message placeholder between its original neighbours in %s',
    (mode) => {
      const messages = ['first', 'middle', 'last'].map((id) => ({
        id,
        role: 'assistant' as const,
        createdAt: 1,
        parts: id === 'middle' ? [] : [{ type: 'text' as const, text: id }],
        ...(id === 'middle' ? { deferredBody: ref } : {})
      }))
      const input = { messages, transcriptChanges: newTranscriptChanges() }
      const snapshot =
        mode === 'opencode'
          ? createOpenCodeBlockModel().advance(input, {})
          : createClaudeBlockModel({ mode, sessionKey: 's' }).advance(input, {})
      const rows = Array.from({ length: snapshot.count }, (_, i) => snapshot.blockAt(i)).filter(
        (block) => block.kind === 'segment' || block.kind === 'deferred'
      )
      expect(rows.map((b) => [b.kind, b.messageId])).toEqual([
        ['segment', 'first'],
        ['deferred', 'middle'],
        ['segment', 'last']
      ])
    }
  )
})
