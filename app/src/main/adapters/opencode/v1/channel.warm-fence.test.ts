import { expect, it, vi } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2/client'
import type { OpenCodeClientLease } from './session-context'
import { openCodeChannel } from './channel'
import { openCodeEvent as event } from './adapter.testfixture'

vi.mock('../../../infra/error-report', () => ({ reportError: vi.fn() }))

it('fences a rejected warm prompt before a queued event can escape the submission buffer', async () => {
  const pending = Promise.withResolvers<IteratorResult<Event>>()
  const events = {
    next: vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: event('server.connected', {}) })
      .mockImplementation(() => pending.promise),
    return: vi.fn(async () => ({ done: true, value: undefined })),
    [Symbol.asyncIterator]() {
      return this
    }
  }
  const promptAsync = vi.fn().mockResolvedValueOnce({})
  const connection = {
    client: { session: { promptAsync, abort: vi.fn(async () => ({})) } },
    prepare: async () => undefined,
    commands: async () => [],
    composer: async () => ({ agents: [], models: [] }),
    events: () => events
  } as unknown as OpenCodeClientLease
  const live = openCodeChannel(
    {
      sessionId: 's1',
      cwd: 'C:/work',
      text: 'initial',
      extensions: { skills: [], hooks: { normalized: {} } }
    },
    async () => connection
  )
  const iterator = live.eventBatches[Symbol.asyncIterator]()
  try {
    expect((await iterator.next()).value?.events[0].type).toBe('session.updated')
    expect((await iterator.next()).value?.events[0].type).toBe('input.echo')
    promptAsync.mockImplementationOnce(() => {
      // Rejection resumes submit first; this callback queues the event pump immediately
      // behind it, before pushTurn's outer catch can retire the channel.
      const rejected = Promise.reject(new Error('rejected prompt'))
      queueMicrotask(() =>
        pending.resolve({
          done: false,
          value: event('session.error', {
            sessionID: 's1',
            error: { name: 'UnknownError', data: { message: 'late frame' } }
          })
        })
      )
      return rejected
    })
    await expect(live.pushTurn!({ text: 'warm' })).rejects.toThrow('rejected prompt')
    expect(await iterator.next()).toEqual({ done: true, value: undefined })
    expect(await live.pushTurn!({ text: 'later' })).toEqual({
      kind: 'rejectedBeforeAccept',
      reason: 'stream_closed'
    })
    expect(promptAsync).toHaveBeenCalledTimes(2)
  } finally {
    live.close()
    pending.resolve({ done: true, value: undefined })
    await iterator.return?.()
  }
})
