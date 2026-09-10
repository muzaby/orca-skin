import { describe, expect, it } from 'vitest'
import { ClaudeInputReceipts } from './claude-input-receipts'
import type { NormalizedEvent } from '../../shared/ipc'

const echo = (text: string, uuid: string): Extract<NormalizedEvent, { type: 'input.echo' }> => ({
  type: 'input.echo' as const,
  sessionId: 's1',
  text,
  uuid
})

describe('Claude input hook correlation', () => {
  it('recognizes coalesced prelude and prompt even when SDK echoes a prelude before the hook', () => {
    const receipts = new ClaudeInputReceipts()
    receipts.submitted('prelude', 'p1')
    receipts.submitted('prompt', 'p2')
    expect(receipts.reconcile(echo('prelude', 'p1'))).toEqual(echo('prelude', 'p1'))
    receipts.prompt({ prompt: 'prelude\nprompt' })
    expect(receipts.drain('s1')).toEqual([])
    receipts.prompt({ prompt: 'prelude\nprompt' })
    expect(receipts.drain('s1')).toMatchObject([
      { type: 'input.received', text: 'prelude\nprompt' }
    ])
  })

  it('uses actual image/text content normalization for hook matching', () => {
    const receipts = new ClaudeInputReceipts()
    receipts.submitted(
      [
        { type: 'text', text: '  image prompt  ' },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: 'abc' }
        }
      ],
      'p1'
    )
    receipts.submitted('next', 'p2')
    receipts.prompt({ prompt: 'image prompt  \nnext' })
    expect(receipts.drain('s1')).toEqual([])
  })

  it('repeated automatic prompt gets one independent receipt per firing', () => {
    const receipts = new ClaudeInputReceipts()
    receipts.prompt({ prompt: 'check again' })
    const first = receipts.drain('s1')
    expect(receipts.drain('s1')).toEqual([])
    receipts.prompt({ prompt: 'check again' })
    const second = receipts.drain('s1')
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(second[0]).not.toEqual(first[0])
  })

  it('matches pending hook with an unattributed user wire instead of recording twice', () => {
    const receipts = new ClaudeInputReceipts()
    receipts.prompt({ prompt: 'tick' })
    expect(receipts.reconcile(echo('tick', 'wire-1'))).toEqual({
      type: 'input.received',
      sessionId: 's1',
      text: 'tick',
      uuid: 'wire-1',
      origin: { kind: 'automatic' }
    })
    expect(receipts.drain('s1')).toEqual([])
  })

  it('keeps a hook pending until a session ID exists and stops recording after close', () => {
    const receipts = new ClaudeInputReceipts()
    receipts.prompt({ prompt: 'tick' })
    expect(receipts.drain('')).toEqual([])
    expect(receipts.drain('s1')).toHaveLength(1)
    receipts.prompt({ prompt: 'pending' })
    receipts.close()
    receipts.submitted('own')
    receipts.prompt({ prompt: 'after close' })
    expect(receipts.drain('s1')).toEqual([])
  })

  it('ignores malformed hook payloads without inventing a prompt', () => {
    const receipts = new ClaudeInputReceipts()
    for (const input of [undefined, null, {}, { prompt: 1 }, { prompt: '' }]) receipts.prompt(input)
    expect(receipts.drain('s1')).toEqual([])
  })

  it('ends late-wire text correlation at the response boundary', () => {
    const receipts = new ClaudeInputReceipts()
    const wire = {
      type: 'input.received' as const,
      sessionId: 's1',
      text: 'tick',
      uuid: 'c1',
      origin: { kind: 'channel' as const, label: 'CI' }
    }
    receipts.prompt({ prompt: 'tick' })
    receipts.drain('s1')
    expect(receipts.reconcile(wire)).toBeUndefined()
    receipts.prompt({ prompt: 'tick' })
    receipts.drain('s1')
    receipts.finishResponse()
    expect(receipts.reconcile({ ...wire, uuid: 'c2' })).toEqual({ ...wire, uuid: 'c2' })
  })
})
