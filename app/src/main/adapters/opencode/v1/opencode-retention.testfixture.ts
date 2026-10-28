import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess, spawn, SpawnOptions } from 'node:child_process'
import { vi } from 'vitest'
import { OpenCodeAdapter } from './adapter'
import { OpenCodeServerPool } from './server'
import { assistantMessage, textPart, jsonResponse } from './adapter.testfixture'
import type { ManagedMcpRuntime } from '../../common/managed-mcp'
import type { ExtensionControl } from '../../common/extension-control'
import { setRootLogger } from '../../../infra/log/registry'
import type { AppLogger } from '../../../infra/log/log-manager'

/** Actual pool/adapter/SDK; only native process and HTTP server are represented at the boundary. */
export function retentionTransport(
  managed: ManagedMcpRuntime | undefined,
  control: ExtensionControl
): {
  adapter: OpenCodeAdapter
  requests: { path: string; directory: string; body?: unknown }[]
  traces: { event: string; data: unknown }[]
  children: { kill: ReturnType<typeof vi.fn> }[]
  configs: Record<string, unknown>[]
  finish(): void
  holdMutation(id?: string): () => void
  failMutation(value: boolean): void
  status(cwd: string, id: string): string | undefined
} {
  const requests: { path: string; directory: string; body?: unknown }[] = []
  const traces: { event: string; data: unknown }[] = []
  const log: AppLogger = {
    child: () => log,
    debug: (event, data) => {
      traces.push({ event, data })
    },
    info: () => {},
    warn: () => {},
    error: () => {}
  }
  setRootLogger(log)
  const children: { kill: ReturnType<typeof vi.fn> }[] = []
  const configs: Record<string, unknown>[] = []
  const profiles = new Map<string, Record<string, unknown>>()
  const instances = new Map<string, Record<string, { status: string }>>()
  const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>()
  const promptIds: { origin: string; directory: string; sessionId: string; promptId: string }[] = []
  let gate: Promise<void> | undefined,
    gateId: string | undefined,
    failed = false,
    port = 45000
  const emit = (origin: string, directory: string, payload: unknown): void => {
    streams
      .get(origin)
      ?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ directory, payload })}\n\n`))
  }
  const state = (origin: string, directory: string): Record<string, { status: string }> => {
    const key = `${origin}:${directory}`
    let value = instances.get(key)
    if (!value) {
      value = {
        native: { status: 'connected' },
        project: { status: 'disabled' },
        ...Object.fromEntries(
          Object.keys(profiles.get(origin) ?? {}).map((id) => [id, { status: 'disabled' }])
        )
      }
      instances.set(key, value)
    }
    return value
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init),
      url = new URL(request.url),
      path = url.pathname
    const directory =
      url.searchParams.get('directory') ??
      decodeURIComponent(request.headers.get('x-opencode-directory') ?? '')
    const body =
      request.method === 'POST' && request.headers.get('content-type')?.includes('json')
        ? await request.clone().json()
        : undefined
    requests.push({ path, directory, body })
    if (path === '/global/health') return jsonResponse({ healthy: true })
    if (path === '/global/event')
      return new Response(
        new ReadableStream({
          start(controller) {
            streams.set(url.origin, controller)
            emit(url.origin, '', { type: 'server.connected', properties: {} })
          },
          cancel() {
            streams.delete(url.origin)
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    if (path === '/config') return jsonResponse({})
    if (path === '/agent') return jsonResponse([{ name: 'retained-agent', mode: 'primary' }])
    if (path === '/provider')
      return jsonResponse({
        all: [{ id: 'test', models: { model: { id: 'model', variants: { deep: {} } } } }],
        connected: ['test'],
        default: {}
      })
    if (path === '/command') return jsonResponse([{ name: 'native:check', hints: [] }])
    if (path === '/mcp') return jsonResponse(state(url.origin, directory))
    if (/^\/mcp\/[^/]+\/(connect|disconnect)$/.test(path)) {
      if (gate && (!gateId || decodeURIComponent(path.split('/')[2]) === gateId)) await gate
      if (failed) return jsonResponse({ error: 'secret-mutation' }, 503)
      state(url.origin, directory)[decodeURIComponent(path.split('/')[2])] = {
        status: path.endsWith('/connect') ? 'connected' : 'disabled'
      }
      return jsonResponse(true)
    }
    if (path === '/instance/dispose') {
      instances.delete(`${url.origin}:${directory}`)
      emit(url.origin, directory, { type: 'server.instance.disposed', properties: { directory } })
      return jsonResponse(true)
    }
    if (path.endsWith('/prompt_async') || /\/session\/[^/]+\/command$/.test(path)) {
      promptIds.push({
        origin: url.origin,
        directory,
        sessionId: path.split('/')[2],
        promptId: body.messageID
      })
      return new Response(null, { status: 204 })
    }
    if (path.endsWith('/abort') || request.method === 'DELETE') return jsonResponse(true)
    throw new Error(`Unexpected ${path}`)
  }
  const spawnProcess = vi.fn((_path: string, args: readonly string[], options: SpawnOptions) => {
    const origin = `http://127.0.0.1:${args[2].split('=')[1]}`
    const config = JSON.parse(options.env!.OPENCODE_CONFIG_CONTENT!) as Record<string, unknown>
    configs.push(config)
    profiles.set(origin, config.mcp as Record<string, unknown>)
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => {
        queueMicrotask(() => child.emit('exit', 0))
        return true
      })
    })
    children.push(child)
    queueMicrotask(() =>
      child.stdout.emit('data', Buffer.from(`opencode server listening on ${origin}\n`))
    )
    return child as unknown as ChildProcess
  })
  const pool = new OpenCodeServerPool({
    dataDirectory: 'unused',
    preferences: () => undefined,
    executable: () => 'fixture-opencode',
    readVersion: async () => '1.18.27',
    allocatePort: async () => ++port,
    spawnProcess: spawnProcess as unknown as typeof spawn,
    fetchImpl
  })
  return {
    adapter: new OpenCodeAdapter(
      pool,
      fetchImpl,
      undefined,
      undefined,
      control,
      undefined,
      managed
    ),
    requests,
    traces,
    children,
    configs,
    status: (cwd, id) => [...instances].find(([key]) => key.endsWith(`:${cwd}`))?.[1][id]?.status,
    finish: () => {
      for (const { origin, directory, sessionId, promptId } of promptIds.splice(0)) {
        emit(origin, directory, {
          type: 'message.updated',
          properties: {
            sessionID: sessionId,
            info: assistantMessage(sessionId, promptId, `assistant-${promptId}`)
          }
        })
        emit(origin, directory, {
          type: 'message.part.updated',
          properties: {
            sessionID: sessionId,
            time: 2,
            part: {
              ...textPart('retained', {
                messageID: `assistant-${promptId}`,
                id: `text-${promptId}`,
                time: { start: 1, end: 2 }
              }),
              sessionID: sessionId
            }
          }
        })
        emit(origin, directory, { type: 'session.idle', properties: { sessionID: sessionId } })
      }
    },
    holdMutation: (id) => {
      const pending = Promise.withResolvers<void>()
      gate = pending.promise
      gateId = id
      return () => {
        gate = undefined
        gateId = undefined
        pending.resolve()
      }
    },
    failMutation: (value) => {
      failed = value
    }
  }
}
