import { describe, expect, it } from 'vitest'
import { ClaudeInputReceipts } from './input-receipts'
import type { NormalizedEvent } from '../../../shared/ipc'

const echo = (text: string, uuid: string): Extract<NormalizedEvent, { type: 'input.echo' }> => ({
  type: 'input.echo' as const,
  sessionId: 's1',
  text,
  uuid,
  nativeMessageId: uuid
})

describe('Claude input hook correlation', () => {
  it('uses merged and later changed response UUIDs to confirm each submitted input once', () => {
    const receipts = new ClaudeInputReceipts()
    receipts.submitted('first', 'u1')
    receipts.submitted('second', 'u2')
    receipts.prompt({ prompt: 'first\nsecond' })
    expect(receipts.response({ user_message_uuids: ['u1', 'unknown'] }, 's1')).toEqual([
      echo('first', 'u1')
    ])
    expect(
      receipts.response({ user_message_uuid: 'u2', user_message_uuids: ['u1', 'u2'] }, 's1')
    ).toEqual([echo('second', 'u2')])
    expect(receipts.response({ user_message_uuids: ['u1', 'u2'] }, 's1')).toEqual([])
  })

  it('does not attribute child responses or absent UUID metadata to queued inputs', () => {
    const receipts = new ClaudeInputReceipts()
    receipts.submitted('queued', 'u1')
    expect(
      receipts.response({ parent_tool_use_id: 'child', user_message_uuid: 'u1' }, 's1')
    ).toEqual([])
    expect(receipts.response({}, 's1')).toEqual([])
    expect(receipts.response({ user_message_uuid: 'u1' }, 's1')).toEqual([echo('queued', 'u1')])
  })
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
      nativeMessageId: 'wire-1',
      origin: { kind: 'automatic', format: 'plain' }
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

  it.each([
    ['system', 'automatic'],
    ['loop_wakeup', 'automatic'],
    ['schedule_wakeup', 'scheduled']
  ])('keeps %s hook provenance and reminder format', (source, kind) => {
    const receipts = new ClaudeInputReceipts()
    const prompt = '<system-reminder>Continue.</system-reminder>'
    receipts.prompt({ source, prompt })
    expect(receipts.drain('s1')).toEqual([
      {
        type: 'input.received',
        sessionId: 's1',
        text: prompt,
        uuid: expect.any(String),
        origin: { kind, format: 'system-reminder' }
      }
    ])
  })

  it.each(['user', 'sdk', 'poll_event', 'future-source', null, 7])(
    'does not infer an automatic input from a %s hook or its tags',
    (source) => {
      const receipts = new ClaudeInputReceipts()
      receipts.prompt({ source, prompt: '<system-reminder>Manual text.</system-reminder>' })
      expect(receipts.drain('s1')).toEqual([])
    }
  )

  it('keeps an explicit system firing separate from a queued human input with identical text', () => {
    const receipts = new ClaudeInputReceipts()
    const text = '<task-notification>check again</task-notification>'
    receipts.submitted(text, 'human-1')
    receipts.prompt({ source: 'system', prompt: text })
    expect(receipts.reconcile(echo(text, 'human-1'))).toEqual(echo(text, 'human-1'))
    expect(receipts.drain('s1')).toMatchObject([
      { type: 'input.received', text, origin: { kind: 'automatic', format: 'tagged' } }
    ])
    receipts.prompt({ source: 'sdk', prompt: text })
    expect(receipts.drain('s1')).toEqual([])
  })

  it('keeps scheduled provenance when the later wire has no origin', () => {
    const receipts = new ClaudeInputReceipts()
    const text = '<system-reminder>Scheduled check.</system-reminder>'
    receipts.prompt({ source: 'schedule_wakeup', prompt: text })
    expect(receipts.reconcile(echo(text, 'wire-1'))).toMatchObject({
      type: 'input.received',
      uuid: 'wire-1',
      text,
      origin: { kind: 'scheduled', format: 'system-reminder' }
    })
    expect(receipts.drain('s1')).toEqual([])
  })

  it('prefers specific wire provenance while retaining its common format exactly once', () => {
    const receipts = new ClaudeInputReceipts()
    const text = '<task-notification>CI passed.</task-notification>'
    receipts.prompt({ source: 'system', prompt: text })
    const wire = {
      type: 'input.received' as const,
      sessionId: 's1',
      uuid: 'wire-1',
      text,
      origin: { kind: 'channel' as const, label: 'CI', format: 'tagged' as const }
    }
    expect(receipts.reconcile(wire)).toEqual(wire)
    expect(receipts.drain('s1')).toEqual([])
    receipts.finishResponse()
    receipts.prompt({ source: 'system', prompt: text })
    expect(receipts.drain('s1')).toHaveLength(1)
  })
})
