import { describe, expect, it, vi } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2/client'
import { OpenCodeSessionContexts } from './session-context'
import { jsonResponse, openCodeEvent as event } from './adapter.testfixture'

interface ContextFixture {
  pool: OpenCodeSessionContexts
  requests: Request[]
  streams: {
    controller: ReadableStreamDefaultController<Uint8Array>
    auth: string
    cancelled: boolean
  }[]
  setRead(value?: (request: Request) => Promise<Response | undefined>): void
  failEvents(value: boolean): void
  setInitialEvent(value: Event): void
  emit(directory: string, value: Event, auth?: string): void
}

function fixture(limit = 4096): ContextFixture {
  const requests: Request[] = []
  const streams: {
    controller: ReadableStreamDefaultController<Uint8Array>
    auth: string
    cancelled: boolean
  }[] = []
  let read: ((request: Request) => Promise<Response | undefined>) | undefined
  let eventFailure = false
  let initialEvent: Event = event('server.connected', {})
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    const path = new URL(request.url).pathname
    if (path === '/global/event') {
      if (eventFailure) return jsonResponse({ secret: 'private response' }, 503)
      let owned: (typeof streams)[number]
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            owned = {
              controller,
              auth: request.headers.get('Authorization') ?? '',
              cancelled: false
            }
            streams.push(owned)
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ payload: initialEvent })}\n\n`)
            )
          },
          cancel() {
            owned.cancelled = true
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    }
    const response = await read?.(request)
    if (response) return response
    if (path === '/instance/dispose') {
      const directory = new URL(request.url).searchParams.get('directory')!
      for (const stream of streams)
        if (!stream.cancelled && stream.auth === request.headers.get('Authorization'))
          stream.controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                directory,
                payload: event('server.instance.disposed', { directory })
              })}\n\n`
            )
          )
      return jsonResponse(true)
    }
    if (path === '/config') return jsonResponse({})
    if (path === '/command') return jsonResponse([{ name: 'native:review', hints: [] }])
    if (path === '/agent') return jsonResponse([{ name: 'build', mode: 'primary' }])
    if (path === '/provider') return jsonResponse({ all: [], connected: [], default: {} })
    throw new Error(`Unexpected ${path}`)
  }
  return {
    pool: new OpenCodeSessionContexts(fetchImpl, limit),
    requests,
    streams,
    setRead: (value?: typeof read) => {
      read = value
    },
    failEvents: (value: boolean) => {
      eventFailure = value
    },
    setInitialEvent: (value: Event) => {
      initialEvent = value
    },
    emit: (directory: string, value: Event, auth = 'Basic one') => {
      for (const stream of streams)
        if (!stream.cancelled && stream.auth === auth)
          stream.controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ directory, payload: value })}\n\n`)
          )
    }
  }
}

const server = { url: 'http://owned.test', headers: { Authorization: 'Basic one' } }
const freshSignal = (): AbortSignal => new AbortController().signal

describe('OpenCode server context with the installed SDK', () => {
  it('rejects acquisition after context shutdown before issuing a native request', async () => {
    const f = fixture()
    f.pool.close()
    await expect(f.pool.acquire(server, 'C:/one')).rejects.toThrow('종료')
    expect(f.requests).toEqual([])
  })
  it('does not start directory work for an already cancelled caller', async () => {
    const f = fixture()
    const lease = await f.pool.acquire(server, 'C:/one')
    const control = new AbortController()
    control.abort(new Error('caller cancelled'))
    try {
      await expect(async () => lease.prepare(control.signal)).rejects.toThrow('caller cancelled')
      await expect(async () => lease.commands(control.signal)).rejects.toThrow('caller cancelled')
      await expect(async () => lease.composer(control.signal)).rejects.toThrow('caller cancelled')
      expect(f.requests).toEqual([])
    } finally {
      await lease.release()
      f.pool.close()
    }
  })
  it('rejects a late SDK result after the final owner closes even when the transport ignores abort', async () => {
    const f = fixture()
    const lease = await f.pool.acquire(server, 'C:/one')
    const gate = Promise.withResolvers<void>()
    let requestSignal: AbortSignal | undefined
    f.setRead(async (request) => {
      if (new URL(request.url).pathname !== '/command') return
      requestSignal = request.signal
      await gate.promise
      return jsonResponse([{ name: 'late', hints: [] }])
    })
    const pending = lease.commands(freshSignal())
    try {
      await vi.waitFor(() => expect(requestSignal).toBeDefined())
      await lease.release()
      expect(requestSignal!.aborted).toBe(true)
      await expect(pending).rejects.toThrow('연결이 종료')
    } finally {
      gate.resolve()
      await lease.release()
      f.pool.close()
    }
  })
  it('requires the server handshake instead of treating an arbitrary first event as ready', async () => {
    const f = fixture()
    f.setInitialEvent(event('session.idle', { sessionID: 'not-a-handshake' }))
    const lease = await f.pool.acquire(server, 'C:/one')
    const iterator = lease.events(freshSignal())
    try {
      await expect(iterator.next()).rejects.toThrow('이벤트 스트림 연결에 실패')
      expect(f.requests.some((request) => new URL(request.url).pathname === '/config')).toBe(false)
    } finally {
      await iterator.return(undefined)
      await lease.release()
      f.pool.close()
    }
  })
  it('shares directory preparation while a caller leaves without cancelling another owner', async () => {
    const f = fixture()
    const one = await f.pool.acquire(server, 'C:/one')
    const two = await f.pool.acquire(server, 'C:/one')
    const gate = Promise.withResolvers<void>()
    let requestSignal: AbortSignal | undefined
    f.setRead(async (request) => {
      if (new URL(request.url).pathname !== '/command') return
      requestSignal = request.signal
      await gate.promise
      return jsonResponse([{ name: 'native:one', hints: [] }])
    })
    const leaving = new AbortController()
    const first = one.commands(leaving.signal).catch((error: unknown) => error)
    const second = two.commands(freshSignal())
    try {
      await vi.waitFor(() => expect(requestSignal).toBeDefined())
      leaving.abort(new Error('caller left'))
      expect(await first).toBeInstanceOf(Error)
      await one.release()
      expect(requestSignal!.aborted).toBe(false)
      gate.resolve()
      expect((await second)[0].name).toBe('native:one')
      expect((await two.commands(freshSignal()))[0].name).toBe('native:one')
      const catalogs = await Promise.all([two.composer(freshSignal()), two.composer(freshSignal())])
      expect(catalogs.map((catalog) => catalog.agents.map((agent) => agent.name))).toEqual([
        ['build'],
        ['build']
      ])
      expect((await two.composer(freshSignal())).agents.map((agent) => agent.name)).toEqual([
        'build'
      ])
      const paths = f.requests.map((request) => new URL(request.url).pathname)
      for (const path of ['/config', '/command', '/agent', '/provider'])
        expect(paths.filter((value) => value === path)).toHaveLength(1)
      f.setRead(async (request) =>
        new URL(request.url).pathname === '/agent'
          ? jsonResponse([{ name: 'fresh', mode: 'primary' }])
          : undefined
      )
      expect((await two.composer(freshSignal(), true)).agents.map((agent) => agent.name)).toEqual([
        'fresh'
      ])
      for (const path of ['/agent', '/provider'])
        expect(f.requests.filter((request) => new URL(request.url).pathname === path)).toHaveLength(
          2
        )
    } finally {
      gate.resolve()
      await one.release()
      await two.release()
      f.pool.close()
    }
  })

  it('shares one global subscription and routes directory and authenticated server generations separately', async () => {
    const f = fixture()
    const one = await f.pool.acquire(server, 'C:/one')
    const two = await f.pool.acquire(server, 'C:/two')
    const other = await f.pool.acquire(
      { ...server, headers: { Authorization: 'Basic other' } },
      'C:/one'
    )
    const otherServer = await f.pool.acquire(
      { ...server, url: 'http://other-owned.test' },
      'C:/one'
    )
    const controls = Array.from({ length: 4 }, () => new AbortController())
    const iterators = [one, two, other, otherServer].map((lease, index) =>
      lease.events(controls[index].signal)
    )
    try {
      for (const iterator of iterators)
        expect((await iterator.next()).value?.type).toBe('server.connected')
      expect(f.streams).toHaveLength(3)
      expect(
        f.requests.filter((request) => new URL(request.url).hostname === 'other-owned.test')
      ).toHaveLength(1)
      f.emit('C:/two', event('session.idle', { sessionID: 'two' }))
      f.emit('C:/one', event('session.idle', { sessionID: 'one' }))
      f.emit('C:/one', event('session.idle', { sessionID: 'private' }), 'Basic other')
      expect((await iterators[0].next()).value?.properties).toEqual({ sessionID: 'one' })
      expect((await iterators[1].next()).value?.properties).toEqual({ sessionID: 'two' })
      expect((await iterators[2].next()).value?.properties).toEqual({ sessionID: 'private' })
      controls[0].abort()
      await iterators[0].return(undefined)
      await one.release()
      expect(f.streams[0].cancelled).toBe(false)
      f.emit('C:/two', event('session.idle', { sessionID: 'still alive' }))
      expect((await iterators[1].next()).value?.properties).toEqual({ sessionID: 'still alive' })
    } finally {
      controls.forEach((control) => control.abort())
      await Promise.all(iterators.map((iterator) => iterator.return(undefined)))
      await one.release()
      await two.release()
      await other.release()
      await otherServer.release()
      f.pool.close()
    }
  })

  it('retires a failed stream without letting the old lease delete a replacement context', async () => {
    const f = fixture()
    f.failEvents(true)
    const old = await f.pool.acquire(server, 'C:/one')
    const first = old.events(freshSignal())
    await expect(first.next()).rejects.toThrow('HTTP 503')
    f.failEvents(false)
    const next = await f.pool.acquire(server, 'C:/one')
    const control = new AbortController()
    const stream = next.events(control.signal)
    try {
      expect((await stream.next()).value?.type).toBe('server.connected')
      await old.release()
      f.emit('C:/one', event('session.idle', { sessionID: 'replacement' }))
      expect((await stream.next()).value?.properties).toEqual({ sessionID: 'replacement' })
      expect(
        f.requests.filter((request) => new URL(request.url).pathname === '/global/event')
      ).toHaveLength(2)
    } finally {
      control.abort()
      await stream.return(undefined)
      await next.release()
      f.pool.close()
    }
  })

  it('disposes one directory and rejects its late inventory while another directory continues', async () => {
    const f = fixture()
    const old = await f.pool.acquire(server, 'C:/one')
    const other = await f.pool.acquire(server, 'C:/two')
    const controls = [new AbortController(), new AbortController(), new AbortController()]
    const stream = old.events(controls[0].signal)
    const second = other.events(controls[1].signal)
    let replacement: Awaited<ReturnType<typeof f.pool.acquire>> | undefined
    let renewed: AsyncGenerator<Event> | undefined
    try {
      await stream.next()
      await second.next()
      await old.commands(freshSignal())
      f.emit('C:/one', event('server.instance.disposed', { directory: 'C:/one' }))
      await expect(stream.next()).rejects.toThrow('프로젝트 연결이 종료')
      replacement = await f.pool.acquire(server, 'C:/one')
      renewed = replacement.events(controls[2].signal)
      await renewed.next()
      await replacement.commands(freshSignal())
      old.rememberCommands([
        { name: 'stale', description: '', argumentHint: '', source: 'harness' }
      ])
      expect((await replacement.commands(freshSignal()))[0].name).toBe('native:review')
      f.emit('C:/two', event('session.idle', { sessionID: 'unaffected' }))
      expect((await second.next()).value?.properties).toEqual({ sessionID: 'unaffected' })
      expect(
        f.requests.filter((request) => new URL(request.url).pathname === '/config')
      ).toHaveLength(2)
      expect(f.streams).toHaveLength(1)
    } finally {
      controls.forEach((control) => control.abort())
      await stream.return(undefined)
      await second.return(undefined)
      await renewed?.return(undefined)
      await old.release()
      await other.release()
      await replacement?.release()
      f.pool.close()
    }
  })

  it('cancels shared SDK work on the last release and ignores a late command result after inventory refresh', async () => {
    const f = fixture()
    const lease = await f.pool.acquire(server, 'C:/one')
    const gate = Promise.withResolvers<void>()
    let requestSignal: AbortSignal | undefined
    f.setRead(async (request) => {
      if (new URL(request.url).pathname !== '/command') return
      requestSignal = request.signal
      await gate.promise
      return jsonResponse([{ name: 'old', hints: [] }])
    })
    const commands = lease.commands(freshSignal())
    try {
      await vi.waitFor(() => expect(requestSignal).toBeDefined())
      lease.rememberCommands([
        { name: 'new', description: '', argumentHint: '', source: 'harness' }
      ])
      gate.resolve()
      expect((await commands)[0].name).toBe('new')
      await lease.release()
      expect(requestSignal!.aborted).toBe(true)
      const next = await f.pool.acquire(server, 'C:/one')
      try {
        f.setRead()
        expect((await next.commands(freshSignal()))[0].name).toBe('native:review')
      } finally {
        await next.release()
      }
    } finally {
      gate.resolve()
      await lease.release()
      f.pool.close()
    }
  })

  it('fails an overflowing subscriber explicitly instead of silently dropping events', async () => {
    const f = fixture(2)
    const lease = await f.pool.acquire(server, 'C:/one')
    const control = new AbortController()
    const iterator = lease.events(control.signal)
    try {
      await iterator.next()
      for (let index = 0; index < 3; index++)
        f.emit('C:/one', event('session.idle', { sessionID: `s${index}` }))
      await new Promise((resolve) => setTimeout(resolve, 25))
      await expect(iterator.next()).rejects.toThrow('이벤트 수신이 지연')
    } finally {
      control.abort()
      await iterator.return(undefined)
      await lease.release()
      f.pool.close()
    }
  })
})
