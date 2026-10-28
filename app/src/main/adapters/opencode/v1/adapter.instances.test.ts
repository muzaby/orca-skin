import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { homedir } from 'node:os'
import type { ChildProcess, spawn } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2/client'
import { OpenCodeAdapter } from './adapter'
import { OpenCodeServerPool } from './server'
import {
  assistantMessage,
  jsonResponse,
  openCodeEvent as event,
  textPart
} from './adapter.testfixture'
import { OpenCodeInstances } from './instance-lifecycle'
import { sameNativePath } from './native-storage'
import { reportError } from '../../../infra/error-report'

vi.mock('../../../infra/error-report', () => ({ reportError: vi.fn() }))
const adapters: OpenCodeAdapter[] = []
afterEach(() => {
  adapters.splice(0).forEach((adapter) => adapter.close())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function fixture(): {
  adapter: OpenCodeAdapter
  pool: OpenCodeServerPool
  requests: Request[]
  children: { kill: ReturnType<typeof vi.fn> }[]
  streams: {
    origin: string
    controller: ReadableStreamDefaultController<Uint8Array>
    closed: boolean
  }[]
  disposals: Request[]
  spawnProcess: ReturnType<typeof vi.fn>
  emit(origin: string, directory: string, payload: Event): void
  finish(request: Request): void
  fail(): void
} {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  const requests: Request[] = []
  const children: { kill: ReturnType<typeof vi.fn> }[] = []
  const streams: {
    origin: string
    controller: ReadableStreamDefaultController<Uint8Array>
    closed: boolean
  }[] = []
  const disposals: Request[] = []
  let failDispose = false
  const emit = (origin: string, directory: string, payload: Event): void => {
    for (const stream of streams)
      if (stream.origin === origin && !stream.closed)
        stream.controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify({ directory, payload })}\n\n`)
        )
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    const url = new URL(request.url)
    const directory =
      url.searchParams.get('directory') ??
      decodeURIComponent(request.headers.get('x-opencode-directory') ?? '')
    if (url.pathname === '/global/health') return jsonResponse({ healthy: true })
    if (url.pathname === '/global/event') {
      let owned: (typeof streams)[number]
      return new Response(
        new ReadableStream({
          start(controller) {
            owned = { origin: url.origin, controller, closed: false }
            streams.push(owned)
            emit(url.origin, '', event('server.connected', {}))
          },
          cancel() {
            owned.closed = true
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    }
    if (url.pathname === '/instance/dispose') {
      disposals.push(request)
      return jsonResponse(
        failDispose ? { secret: 'private path and credential' } : true,
        failDispose ? 500 : 200
      )
    }
    if (url.pathname === '/config') return jsonResponse({})
    if (url.pathname === '/command') return jsonResponse([{ name: directory, hints: [] }])
    if (url.pathname === '/agent') return jsonResponse([])
    if (url.pathname === '/provider') return jsonResponse({ all: [], connected: [], default: {} })
    if (url.pathname === '/session' && request.method === 'POST') return jsonResponse({ id: 's1' })
    if (url.pathname === '/session/s1' && request.method === 'GET')
      return jsonResponse({ id: 's1', directory, time: { updated: 10 } })
    if (url.pathname === '/session/status') return jsonResponse({})
    if (url.pathname === '/session/s1/message')
      return jsonResponse(
        request.method === 'GET' ? [] : { info: assistantMessage(), parts: [textPart('complete')] }
      )
    if (url.pathname === '/session/s1/prompt_async') {
      const body = await request.json()
      emit(
        url.origin,
        directory,
        event('message.updated', { sessionID: 's1', info: assistantMessage('s1', body.messageID) })
      )
      emit(
        url.origin,
        directory,
        event('message.part.updated', {
          sessionID: 's1',
          time: 1,
          part: textPart('channel', { time: { start: 1, end: 2 } })
        })
      )
      emit(url.origin, directory, event('session.idle', { sessionID: 's1' }))
      return new Response(null, { status: 204 })
    }
    if (request.method === 'DELETE' || url.pathname.endsWith('/abort')) return jsonResponse(true)
    throw new Error(`Unexpected ${request.method} ${url.pathname}`)
  }
  let port = 41000
  const spawnProcess = vi.fn((_executable: string, args?: unknown) => {
    if (!Array.isArray(args)) throw new Error('Expected native server arguments')
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true)
    })
    children.push(child)
    queueMicrotask(() =>
      child.stdout.emit(
        'data',
        Buffer.from(`opencode server listening on http://127.0.0.1:${args[2].split('=')[1]}\n`)
      )
    )
    return child as unknown as ChildProcess
  })
  const pool = new OpenCodeServerPool({
    dataDirectory: 'unused',
    preferences: () => undefined,
    executable: () => 'fixture-opencode',
    readVersion: async () => '1.17.19',
    allocatePort: async () => ++port,
    spawnProcess: spawnProcess as typeof spawn,
    fetchImpl
  })
  const adapter = new OpenCodeAdapter(pool, fetchImpl)
  adapters.push(adapter)
  const finish = (request: Request): void => {
    const url = new URL(request.url)
    const directory = url.searchParams.get('directory')!
    emit(url.origin, directory, event('server.instance.disposed', { directory }))
  }
  return {
    adapter,
    pool,
    requests,
    children,
    streams,
    disposals,
    spawnProcess,
    emit,
    finish,
    fail: () => {
      failDispose = true
    }
  }
}

const signal = (): AbortSignal => new AbortController().signal

describe('Owned server, directory lifecycle and actual SDK composition', () => {
  it('reserves the sole context during last-owner cleanup and rejects late direct SDK requests', async () => {
    const f = fixture()
    const acquireInstance = vi.spyOn(OpenCodeInstances.prototype, 'acquire')
    const old = await f.adapter.client({}, undefined, 'C:/one')
    await old.prepare(signal())
    const releasing = old.release()
    await releasing
    await expect(old.client.config.get()).rejects.toThrow('종료')
    expect(f.disposals).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(90_000)
    await vi.waitFor(() => expect(f.disposals).toHaveLength(1))
    const joined = vi.fn()
    const acquiring = f.adapter.client({}, undefined, 'C:/one').then((lease) => {
      joined()
      return lease
    })
    // Let acquisition reach the closing barrier while the sole owner is still disposing.
    await vi.waitFor(() => expect(acquireInstance).toHaveBeenCalledTimes(2))
    expect(joined).not.toHaveBeenCalled()
    f.finish(f.disposals[0])
    await releasing
    const renewed = await acquiring
    await renewed.prepare(signal())
    expect(renewed.generation).not.toBe(old.generation)
    expect(f.children).toHaveLength(1)
    expect(f.children[0].kill).not.toHaveBeenCalled()
    expect(f.streams).toHaveLength(1)
    expect(f.streams[0].closed).toBe(false)
    const requests = f.requests.length
    await expect(old.client.config.get()).rejects.toThrow('종료')
    expect(f.requests).toHaveLength(requests)
    const closing = renewed.release()
    await closing
    await vi.advanceTimersByTimeAsync(90_000)
    await vi.waitFor(() => expect(f.disposals).toHaveLength(2))
    f.finish(f.disposals[1])
    await closing
    await vi.waitFor(() => expect(f.children[0].kill).toHaveBeenCalledOnce())
  })

  it('keeps one process for A/B, waits for native completion, and fences same-directory reacquisition', async () => {
    const f = fixture()
    const [a, a2, b] = await Promise.all(
      ['C:/one', 'C:/one/.', 'C:/two'].map((cwd) => f.adapter.client({}, undefined, cwd))
    )
    const inventories = await Promise.all([
      a.commands(signal()),
      a2.commands(signal()),
      b.commands(signal())
    ])
    expect(inventories.map((list) => list[0].name.replaceAll('\\', '/'))).toEqual([
      'C:/one',
      'C:/one',
      'C:/two'
    ])
    expect(f.children).toHaveLength(1)
    expect(f.requests.filter((r) => new URL(r.url).pathname === '/config')).toHaveLength(2)
    await a.release()
    await a.release()
    expect(f.disposals).toHaveLength(0)
    const releasing = a2.release()
    expect(a2.release()).toBe(releasing)
    await releasing
    await vi.advanceTimersByTimeAsync(90_000)
    const joined = vi.fn()
    const acquiring = f.adapter.client({}, undefined, 'C:/one').then((value) => {
      joined()
      return value
    })
    await vi.waitFor(() => expect(f.disposals).toHaveLength(1))
    expect(joined).not.toHaveBeenCalled()
    expect(f.children[0].kill).not.toHaveBeenCalled()
    expect((await b.commands(signal()))[0].name.replaceAll('\\', '/')).toBe('C:/two')
    f.finish(f.disposals[0])
    await releasing
    const renewed = await acquiring
    await renewed.prepare(signal())
    expect(f.requests.filter((r) => new URL(r.url).pathname === '/config')).toHaveLength(3)
    await expect(a.client.config.get()).rejects.toThrow('종료')
    const final = Promise.all([b.release(), renewed.release()])
    await final
    await vi.advanceTimersByTimeAsync(90_000)
    await vi.waitFor(() => expect(f.disposals).toHaveLength(3))
    f.finish(f.disposals[1])
    await Promise.resolve()
    expect(f.children[0].kill).not.toHaveBeenCalled()
    f.finish(f.disposals[2])
    await final
    await vi.waitFor(() => expect(f.children[0].kill).toHaveBeenCalledOnce())
    expect(f.streams).toHaveLength(1)
    expect(f.streams[0].closed).toBe(true)
    expect(
      (f.spawnProcess.mock.calls[0] as unknown as [string, string[], { cwd: string }])[2].cwd
    ).toBe(homedir())
  })

  it('retires failed cleanup without killing B and reports only a safe error before new generation startup', async () => {
    const f = fixture()
    const a = await f.adapter.client({}, undefined, 'C:/one')
    const b = await f.adapter.client({}, undefined, 'C:/two')
    await Promise.all([a.prepare(signal()), b.prepare(signal())])
    f.fail()
    await a.release()
    await vi.advanceTimersByTimeAsync(90_000)
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
    expect(f.children[0].kill).not.toHaveBeenCalled()
    expect((await b.commands(signal()))[0].name.replaceAll('\\', '/')).toBe('C:/two')
    const next = await f.adapter.client({}, undefined, 'C:/one')
    await next.prepare(signal())
    expect(f.children).toHaveLength(2)
    expect(
      f.requests
        .filter((r) => new URL(r.url).pathname === '/config')
        .map((r) => r.headers.get('Authorization'))[0]
    ).not.toBe(
      f.requests
        .filter((r) => new URL(r.url).pathname === '/config')[2]
        .headers.get('Authorization')
    )
    expect(reportError).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain('private')
    f.adapter.close()
    await Promise.all([b.release(), next.release()])
    expect(f.children.map((child) => child.kill.mock.calls.length)).toEqual([1, 1])
  })

  it('sends default POST directory and workspace without allowing a foreign directory or bootstrapping unused leases', async () => {
    const f = fixture()
    const a = await f.adapter.client({}, undefined, 'C:/프로젝트')
    await expect(a.client.session.create({ directory: 'C:/foreign' })).rejects.toThrow('경로')
    expect(f.requests.map((r) => new URL(r.url).pathname)).toEqual(['/global/health'])
    await a.client.session.create({ workspace: 'workspace-one' })
    const post = f.requests.find((r) => new URL(r.url).pathname === '/session')!
    expect(
      sameNativePath(decodeURIComponent(post.headers.get('x-opencode-directory')!), 'C:/프로젝트')
    ).toBe(true)
    expect(new URL(post.url).searchParams.get('workspace')).toBe('workspace-one')
    const unused = await f.adapter.client({}, undefined, 'C:/unused')
    await unused.release()
    expect(f.disposals).toHaveLength(0)
    const releasing = a.release()
    await releasing
    await vi.advanceTimersByTimeAsync(90_000)
    await vi.waitFor(() => expect(f.disposals).toHaveLength(1))
    f.finish(f.disposals[0])
    await releasing
  })

  it.each(['complete', 'recover', 'history', 'channel'] as const)(
    'returns the %s consumer before idle expiry and retains the server until native completion',
    async (consumer) => {
      const f = fixture()
      let operation: Promise<unknown>
      vi.spyOn(f.pool, 'databasePath').mockResolvedValue('C:/fixture/opencode.db')
      if (consumer === 'complete')
        operation = f.adapter.complete({ cwd: 'C:/one', prompt: 'Title' })
      else if (consumer === 'recover')
        operation = f.adapter.recoverSession({ cwd: 'C:/one', sessionId: 's1' })
      else if (consumer === 'history')
        operation = f.adapter.readHistory({ cwd: 'C:/one', sessionId: 's1' })
      else {
        const live = f.adapter.sendMessage({
          sessionId: 's1',
          cwd: 'C:/one',
          text: 'Hello',
          extensions: { skills: [], hooks: { normalized: {} } }
        })
        operation = (async () => {
          for await (const batch of live.eventBatches)
            if (batch.events.some((e) => e.type === 'turn.ended')) {
              live.close()
              break
            }
        })()
      }
      const settled = vi.fn()
      const result = operation.then((value) => {
        settled()
        return value
      })
      const output = await result
      expect(settled).toHaveBeenCalledOnce()
      expect(f.disposals).toHaveLength(0)
      await vi.advanceTimersByTimeAsync(90_000)
      await vi.waitFor(() => expect(f.disposals).toHaveLength(1))
      expect(f.children[0].kill).not.toHaveBeenCalled()
      f.finish(f.disposals[0])
      await vi.waitFor(() => expect(f.children[0].kill).toHaveBeenCalledOnce())
      if (consumer === 'complete') expect(output).toBe('complete')
      if (consumer === 'recover') expect(output).toEqual({ sessionId: 's1', freshStart: false })
      if (consumer === 'history')
        expect(output).toMatchObject({ status: 'ready', snapshot: { messages: [] } })
      await vi.waitFor(() => expect(f.children[0].kill).toHaveBeenCalledOnce())
      expect(f.streams).toHaveLength(1)
      const deletes = f.requests.filter((r) => r.method === 'DELETE')
      expect(deletes).toHaveLength(consumer === 'complete' ? 1 : 0)
    }
  )
})
