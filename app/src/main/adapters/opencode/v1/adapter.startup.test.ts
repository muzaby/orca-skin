import { describe, expect, it, vi } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2/client'
import type { LiveTurn, ProviderMessageBatch } from '../../common/types'
import { OpenCodeAdapter } from './adapter'
import {
  assistantMessage,
  jsonResponse,
  openCodeEvent as event,
  textPart
} from './adapter.testfixture'

interface StartupFixture {
  adapter: OpenCodeAdapter
  requests: Request[]
  releases: ReturnType<typeof vi.fn>
  streams: { controller: ReadableStreamDefaultController<Uint8Array>; closed: boolean }[]
  setConfig(read?: (request: Request) => Promise<Response>): void
  setCommands(read?: (request: Request) => Promise<Response>): void
  setProviders(read?: (request: Request) => Promise<Response>): void
  send(text: string, cwd?: string): LiveTurn
}

function fixture(): StartupFixture {
  const requests: Request[] = []
  const releases = vi.fn()
  const streams: { controller: ReadableStreamDefaultController<Uint8Array>; closed: boolean }[] = []
  let nextID = 0
  let configRead: ((request: Request) => Promise<Response>) | undefined
  let commandRead: ((request: Request) => Promise<Response>) | undefined
  let providerRead: ((request: Request) => Promise<Response>) | undefined
  const emit = (directory: string, payload: Event): void => {
    for (const stream of streams)
      if (!stream.closed)
        stream.controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify({ directory, payload })}\n\n`)
        )
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    const url = new URL(request.url)
    const directory = url.searchParams.get('directory') ?? 'C:/work'
    if (url.pathname === '/global/event') {
      let owned: (typeof streams)[number]
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            owned = { controller, closed: false }
            streams.push(owned)
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ payload: event('server.connected', {}) })}\n\n`
              )
            )
          },
          cancel() {
            owned.closed = true
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    }
    if (url.pathname === '/config') return configRead ? configRead(request) : jsonResponse({})
    if (url.pathname === '/instance/dispose') {
      emit(directory, event('server.instance.disposed', { directory }))
      return jsonResponse(true)
    }
    if (url.pathname === '/mcp') return jsonResponse({})
    if (url.pathname === '/agent') return jsonResponse([{ name: 'build', mode: 'primary' }])
    if (url.pathname === '/provider')
      return providerRead
        ? providerRead(request)
        : jsonResponse({ all: [], connected: [], default: {} })
    if (url.pathname === '/command')
      return commandRead
        ? commandRead(request)
        : jsonResponse([{ name: 'native:review', hints: [] }])
    if (url.pathname === '/session' && request.method === 'POST')
      return jsonResponse({ id: `s${++nextID}` })
    if (/\/(prompt_async|command)$/.test(url.pathname)) {
      const body = await request.json()
      const sessionID = url.pathname.split('/')[2]
      const answer = assistantMessage(sessionID, body.messageID, `a-${body.messageID}`)
      // A matching session/message from another directory must never reach this transcript.
      emit('C:/foreign', event('message.updated', { sessionID, info: answer }))
      emit(
        'C:/foreign',
        event('message.part.updated', {
          sessionID,
          time: 1,
          part: textPart('Foreign secret', {
            id: `foreign-${body.messageID}`,
            sessionID,
            messageID: answer.id
          })
        })
      )
      emit(directory, event('message.updated', { sessionID, info: answer }))
      emit(
        directory,
        event('message.part.updated', {
          sessionID,
          time: 2,
          part: textPart(`Reply ${sessionID}`, {
            id: `text-${body.messageID}`,
            sessionID,
            messageID: answer.id,
            time: { start: 1, end: 2 }
          })
        })
      )
      emit(directory, event('session.idle', { sessionID }))
      return new Response(null, { status: 204 })
    }
    if (url.pathname.endsWith('/abort')) return jsonResponse(true)
    throw new Error(`Unexpected request ${url.pathname}`)
  }
  const adapter = new OpenCodeAdapter(
    {
      acquire: async () => ({
        url: 'http://owned-startup.test',
        headers: { Authorization: 'Basic startup' },
        release: releases
      }),
      installed: async () => ({ installed: true, version: '1.17.19' }),
      close: vi.fn()
    },
    fetchImpl
  )
  return {
    adapter,
    requests,
    releases,
    streams,
    setConfig: (read?: typeof configRead) => {
      configRead = read
    },
    setCommands: (read?: typeof commandRead) => {
      commandRead = read
    },
    setProviders: (read) => {
      providerRead = read
    },
    send: (text: string, cwd = 'C:/work') =>
      adapter.sendMessage({
        sessionId: null,
        text,
        cwd,
        extensions: { skills: [], hooks: { normalized: {} } }
      })
  }
}

async function frame(
  iterator: AsyncIterator<ProviderMessageBatch>
): Promise<ProviderMessageBatch['events']> {
  const events: ProviderMessageBatch['events'] = []
  for (;;) {
    const next = await iterator.next()
    if (next.done) return events
    events.push(...next.value.events)
    if (next.value.events.some((value) => value.type === 'turn.ended' || value.type === 'error'))
      return events
  }
}

async function close(live: LiveTurn, iterator: AsyncIterator<ProviderMessageBatch>): Promise<void> {
  live.close()
  await iterator.return?.()
}

describe('Desktop-style OpenCode startup through the real SDK', () => {
  it('reuses draft preparation for a selected-agent first prompt while provider metadata is stalled', async () => {
    const f = fixture()
    const gate = Promise.withResolvers<void>()
    f.setProviders(async () => {
      await gate.promise
      return jsonResponse({ all: [] })
    })
    const preview = await f.adapter.prepareComposer({ cwd: 'C:/work' })
    const models = preview.read('models', new AbortController().signal)
    expect(await preview.read('agents', new AbortController().signal)).toEqual([{ name: 'build' }])
    expect(f.requests.map((r) => new URL(r.url).pathname)).toEqual(['/provider', '/agent'])
    const live = f.adapter.sendMessage({
      sessionId: null,
      cwd: 'C:/work',
      text: 'use selected agent',
      harnessAgent: 'build',
      extensions: { skills: [], hooks: { normalized: {} } }
    })
    const iterator = live.eventBatches[Symbol.asyncIterator]()
    try {
      expect((await frame(iterator)).some((event) => event.type === 'turn.ended')).toBe(true)
      const request = f.requests.find((r) => new URL(r.url).pathname.endsWith('/prompt_async'))!
      expect(await request.json()).toMatchObject({ agent: 'build' })
      await preview.release()
      expect(f.requests.some((r) => new URL(r.url).pathname === '/instance/dispose')).toBe(false)
      expect(f.requests.filter((r) => new URL(r.url).pathname === '/agent')).toHaveLength(1)
      expect(f.requests.filter((r) => new URL(r.url).pathname === '/provider')).toHaveLength(1)
    } finally {
      gate.resolve()
      await models
      await preview.release()
      await close(live, iterator)
      f.adapter.close()
    }
  })
  it('connects global events before project readiness and submits a normal first prompt while commands are still loading', async () => {
    const f = fixture()
    const project = Promise.withResolvers<void>()
    const commands = Promise.withResolvers<void>()
    let commandSignal: AbortSignal | undefined
    f.setConfig(async () => {
      await project.promise
      return jsonResponse({})
    })
    f.setCommands(async (request) => {
      commandSignal = request.signal
      await commands.promise
      return jsonResponse([])
    })
    const live = f.send('First ordinary input')
    const iterator = live.eventBatches[Symbol.asyncIterator]()
    const pending = frame(iterator)
    try {
      await vi.waitFor(() =>
        expect(f.requests.some((request) => new URL(request.url).pathname === '/config')).toBe(true)
      )
      expect(f.requests.map((request) => new URL(request.url).pathname)).toEqual([
        '/global/event',
        '/agent',
        '/provider',
        '/config'
      ])
      project.resolve()
      const events = await pending
      expect(commandSignal).toBeDefined()
      expect(commandSignal!.aborted).toBe(false)
      expect(events.some((value) => value.type === 'turn.ended')).toBe(true)
      expect(events.some((value) => value.type === 'error')).toBe(false)
      expect(JSON.stringify(events)).not.toContain('Foreign secret')
      const paths = f.requests.map((request) => new URL(request.url).pathname)
      expect(paths.indexOf('/config')).toBeLessThan(paths.indexOf('/session'))
      expect(paths.indexOf('/session')).toBeLessThan(paths.indexOf('/session/s1/prompt_async'))
    } finally {
      project.resolve()
      commands.resolve()
      await close(live, iterator)
      f.adapter.close()
    }
  })

  it('shares one subscription and bootstrap for many first sessions and preserves the remaining owner after close', async () => {
    const f = fixture()
    const lives = Array.from({ length: 8 }, (_, index) => f.send(`Input ${index}`))
    const iterators = lives.map((live) => live.eventBatches[Symbol.asyncIterator]())
    try {
      const frames = await Promise.all(iterators.map(frame))
      for (let index = 0; index < frames.length; index++) {
        expect(frames[index].some((value) => value.type === 'turn.ended')).toBe(true)
        expect(JSON.stringify(frames[index])).not.toContain('Foreign secret')
        const text = frames[index]
          .filter((value) => value.type === 'message.completed')
          .map((value) => value.message.text)
          .join('')
        expect(text).toBe(`Reply s${index + 1}`)
      }
      const paths = f.requests.map((request) => new URL(request.url).pathname)
      for (const path of ['/global/event', '/config', '/command', '/agent', '/provider'])
        expect(paths.filter((value) => value === path)).toHaveLength(1)
      expect(paths.filter((value) => value === '/session')).toHaveLength(8)
      await close(lives[0], iterators[0])
      expect(f.streams[0].closed).toBe(false)
      await lives[1].pushTurn!({ text: '/native:review exact args' })
      const next = await frame(iterators[1])
      expect(next.some((value) => value.type === 'turn.ended')).toBe(true)
      const sent = f.requests.filter(
        (request) => new URL(request.url).pathname.endsWith('/command') && request.method === 'POST'
      )
      expect(sent).toHaveLength(1)
      expect(await sent[0].json()).toMatchObject({
        command: 'native:review',
        arguments: 'exact args'
      })
      expect(
        f.requests.filter((request) => new URL(request.url).pathname === '/command')
      ).toHaveLength(1)
    } finally {
      await Promise.all(lives.map((live, index) => close(live, iterators[index])))
      try {
        expect(f.streams.every((stream) => stream.closed)).toBe(true)
      } finally {
        f.adapter.close()
      }
    }
    expect(f.streams.every((stream) => stream.closed)).toBe(true)
    expect(f.releases).toHaveBeenCalledTimes(8)
  })

  it('closes the shared event transport on adapter shutdown while channel owners still exist', async () => {
    const f = fixture()
    const lives = [f.send('One'), f.send('Two')]
    const iterators = lives.map((live) => live.eventBatches[Symbol.asyncIterator]())
    try {
      await Promise.all(iterators.map(frame))
      expect(f.streams[0].closed).toBe(false)
      f.adapter.close()
      const ended = await Promise.all(iterators.map(frame))
      for (const events of ended) expect(events.some((value) => value.type === 'error')).toBe(true)
      expect(f.streams[0].closed).toBe(true)
      expect(f.requests.filter((request) => request.url.includes('/prompt_async'))).toHaveLength(2)
    } finally {
      await Promise.all(lives.map((live, index) => close(live, iterators[index])))
      f.adapter.close()
    }
  })

  it('waits for directory command readiness on the first slash input without creating a second query', async () => {
    const f = fixture()
    const gate = Promise.withResolvers<void>()
    f.setCommands(async () => {
      await gate.promise
      return jsonResponse([{ name: 'native:review', hints: [] }])
    })
    const live = f.send('/native:review first argument')
    const iterator = live.eventBatches[Symbol.asyncIterator]()
    const pending = frame(iterator)
    try {
      await vi.waitFor(() =>
        expect(f.requests.some((request) => new URL(request.url).pathname === '/command')).toBe(
          true
        )
      )
      expect(
        f.requests.some(
          (request) =>
            request.url.includes('/prompt_async') || /\/session\/[^/]+\/command/.test(request.url)
        )
      ).toBe(false)
      gate.resolve()
      expect((await pending).some((value) => value.type === 'turn.ended')).toBe(true)
      const sent = f.requests.filter(
        (request) => request.method === 'POST' && new URL(request.url).pathname.endsWith('/command')
      )
      expect(sent).toHaveLength(1)
      expect(await sent[0].json()).toMatchObject({
        command: 'native:review',
        arguments: 'first argument'
      })
      expect(
        f.requests.filter((request) => new URL(request.url).pathname === '/command')
      ).toHaveLength(1)
    } finally {
      gate.resolve()
      await close(live, iterator)
      f.adapter.close()
    }
  })

  it('uses refreshed native inventory for the next slash input without another command query', async () => {
    const f = fixture()
    const live = f.send('/native:review first')
    const iterator = live.eventBatches[Symbol.asyncIterator]()
    try {
      await frame(iterator)
      f.setCommands(async () => jsonResponse([{ name: 'native:fresh', hints: [] }]))
      const inventory = await live.nativeResources!()
      expect(inventory.commands?.map((command) => command.name)).toEqual(['native:fresh'])
      expect(await live.pushTurn!({ text: '/native:fresh next args' })).toEqual({
        kind: 'accepted'
      })
      expect((await frame(iterator)).some((value) => value.type === 'turn.ended')).toBe(true)
      const commands = f.requests.filter(
        (request) => request.method === 'POST' && new URL(request.url).pathname.endsWith('/command')
      )
      expect(commands).toHaveLength(2)
      expect(await commands[1].json()).toMatchObject({
        command: 'native:fresh',
        arguments: 'next args'
      })
      expect(
        f.requests.filter((request) => new URL(request.url).pathname === '/command')
      ).toHaveLength(2)
      expect(f.requests.some((request) => request.url.includes('/prompt_async'))).toBe(false)
    } finally {
      await close(live, iterator)
      f.adapter.close()
    }
  })

  it('reports project preparation failure distinctly and allows an explicit new attempt', async () => {
    const f = fixture()
    f.setConfig(async () => jsonResponse({ private: 'private body' }, 503))
    const live = f.send('/native:review')
    const iterator = live.eventBatches[Symbol.asyncIterator]()
    try {
      const events = await frame(iterator)
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({ message: expect.stringContaining('프로젝트 준비') })
        })
      )
      expect(JSON.stringify(events)).not.toContain('private body')
      expect(f.requests.some((request) => request.method === 'POST')).toBe(false)
    } finally {
      await close(live, iterator)
    }
    f.setConfig()
    const retry = f.send('Explicit retry')
    const next = retry.eventBatches[Symbol.asyncIterator]()
    try {
      expect((await frame(next)).some((value) => value.type === 'turn.ended')).toBe(true)
      expect(f.requests.filter((request) => request.url.includes('/prompt_async'))).toHaveLength(1)
      expect(f.streams).toHaveLength(2)
    } finally {
      await close(retry, next)
      f.adapter.close()
    }
  })
})
