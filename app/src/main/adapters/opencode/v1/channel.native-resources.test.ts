import { createOpencodeClient, type Event } from '@opencode-ai/sdk/v2/client'
import { expect, it, vi } from 'vitest'
import { openCodeEvent as event } from './adapter.testfixture'
import { openCodeChannel } from './channel'
import type { OpenCodeClientLease } from './session-context'

it('shares one configuration read between plugin and skill projections in a channel inventory', async () => {
  const calls: string[] = []
  const client = createOpencodeClient({
    baseUrl: 'http://fixture.test',
    fetch: async (input) => {
      const path = new URL(input instanceof Request ? input.url : String(input)).pathname
      calls.push(path)
      const value =
        path === '/command'
          ? [{ name: 'design', source: 'skill', hints: [] }]
          : path === '/config'
            ? { plugin: ['@vendor/plugin@1'] }
            : path === '/skill'
              ? []
              : {}
      return new Response(JSON.stringify(value), {
        headers: { 'content-type': 'application/json' }
      })
    }
  })
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
  const connection = {
    signal: new AbortController().signal,
    client,
    prepare: async () => undefined,
    commands: async () => [],
    agents: async () => [],
    models: async () => [],
    mcp: async () => [],
    rememberCommands: vi.fn(),
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
    await iterator.next()
    await iterator.next()
    const inventory = await live.nativeResources!()
    expect(inventory.state).toBe('connected')
    expect(inventory.items).toContainEqual(
      expect.objectContaining({ name: '@vendor/plugin@1', kind: 'plugin' })
    )
    expect(calls.filter((path) => path === '/config')).toHaveLength(1)
    expect(connection.rememberCommands).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'design', skill: false })
    ])
  } finally {
    live.close()
    pending.resolve({ done: true, value: undefined })
    await iterator.return?.()
  }
})
