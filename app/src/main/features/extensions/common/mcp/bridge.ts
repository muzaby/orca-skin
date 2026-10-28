import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { getLogger } from '../../../../infra/log/registry'
import type {
  ManagedMcpBridgeLease,
  ManagedMcpSnapshot,
  ManagedMcpSource
} from '../../../../adapters/common/managed-mcp'

const resultSchema = z
  .object({
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
    isError: z.boolean().optional(),
    structuredContent: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough()

interface Generation {
  references: number
  lease: ManagedMcpBridgeLease
}

/** One app-owned listener per live source generation; no session/cwd authority. */
export class ManagedMcpBridge {
  private readonly generations = new Map<number, Promise<Generation>>()
  private closed = false
  constructor(private readonly source: ManagedMcpSource) {}

  async acquire(snapshot: ManagedMcpSnapshot): Promise<ManagedMcpBridgeLease> {
    if (this.closed) throw new Error('MCP bridge is closed')
    const revision = snapshot.definitionRevision ?? snapshot.revision
    let flight = this.generations.get(revision)
    if (!flight) {
      flight = this.open(snapshot).catch((error: unknown) => {
        if (this.generations.get(revision) === flight) this.generations.delete(revision)
        throw error
      })
      this.generations.set(revision, flight)
    }
    const generation = await flight
    if (this.closed) {
      await generation.lease.release()
      throw new Error('MCP bridge is closed')
    }
    generation.references++
    let released = false
    return {
      endpoints: generation.lease.endpoints,
      release: async () => {
        if (released) return
        released = true
        if (--generation.references) return
        if (this.generations.get(revision) === flight) this.generations.delete(revision)
        await generation.lease.release()
      }
    }
  }

  private async open(snapshot: ManagedMcpSnapshot): Promise<Generation> {
    const trace = randomUUID()
    const endpoints = new Map<string, { url: string; token: string }>()
    if (!snapshot.plugins.size)
      return { references: 0, lease: { endpoints, release: async () => undefined } }
    const token = randomBytes(32).toString('hex')
    const lifetime = new AbortController()
    const sessions = new Map<
      string,
      {
        id: string
        server: McpServer
        transport: StreamableHTTPServerTransport
        controller: AbortController
      }
    >()
    const calls = new Map<AbortController, string>()
    let pendingSessions = 0
    let activeCalls = 0
    let host = ''
    const authorized = (id: string): boolean => {
      const original = snapshot.plugins.get(id)
      const current = this.source.snapshot().plugins.get(id)
      return (
        !!original &&
        !!current &&
        original.server === current.server &&
        current.authorized() &&
        current.server.descriptor.executionScope === 'application'
      )
    }
    const unsubscribe = this.source.subscribe(() => {
      for (const [controller, id] of calls) if (!authorized(id)) controller.abort()
    })
    const reject = (res: ServerResponse, code: number): void => {
      res.writeHead(code)
      res.end()
    }
    const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (lifetime.signal.aborted) return reject(res, 503)
      const auth = req.headers.authorization ?? ''
      const expected = `Bearer ${token}`
      if (
        Buffer.byteLength(auth) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
      )
        return reject(res, 401)
      if (req.headers.host !== host || req.headers.origin !== undefined) return reject(res, 403)
      const id = req.url?.startsWith('/mcp/') ? decodeURIComponent(req.url.slice(5)) : ''
      const plugin = snapshot.plugins.get(id)
      if (!plugin) return reject(res, 404)
      if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE')
        return reject(res, 405)
      let body: unknown
      if (req.method === 'POST') {
        const chunks: Buffer[] = []
        let length = 0
        for await (const chunk of req) {
          length += chunk.length
          if (length > 1024 * 1024) {
            reject(res, 413)
            req.resume()
            return
          }
          chunks.push(Buffer.from(chunk))
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          return reject(res, 400)
        }
      }
      const sessionId = req.headers['mcp-session-id']
      if (sessionId !== undefined) {
        const session = typeof sessionId === 'string' && sessions.get(sessionId)
        if (!session || session.id !== id) return reject(res, 404)
        await session.transport.handleRequest(req, res, body)
        return
      }
      if (req.method !== 'POST' || !isInitializeRequest(body)) return reject(res, 400)
      if (!authorized(id)) return reject(res, 403)
      if (sessions.size + pendingSessions >= 256) return reject(res, 429)
      pendingSessions++
      const controller = new AbortController()
      const server = new McpServer(
        { name: id, version: '1.0.0' },
        { instructions: plugin.server.descriptor.instructions }
      )
      let transport: StreamableHTTPServerTransport | undefined
      try {
        const implementations = new Map(
          plugin.server.implementations.map((entry) => [entry.name, entry])
        )
        for (const declaration of plugin.server.descriptor.tools) {
          const implementation = implementations.get(declaration.name)
          if (!implementation) throw new Error('Missing tool implementation')
          server.registerTool(
            declaration.name,
            {
              description: declaration.description,
              annotations: declaration.annotations,
              inputSchema: z.object(implementation.inputSchema)
            },
            async (args, extra) => {
              if (!authorized(id))
                return {
                  content: [{ type: 'text' as const, text: 'MCP 인증을 확인해 주세요.' }],
                  isError: true
                }
              if (activeCalls >= 64)
                return {
                  content: [{ type: 'text' as const, text: 'MCP 동시 호출 한도를 초과했습니다.' }],
                  isError: true
                }
              const revoked = new AbortController()
              calls.set(revoked, id)
              activeCalls++
              const signal = AbortSignal.any([
                extra.signal,
                controller.signal,
                lifetime.signal,
                revoked.signal
              ])
              try {
                signal.throwIfAborted()
                const result = resultSchema.parse(
                  await implementation.handler(args, {
                    scope: 'application',
                    getSignal: () => signal
                  })
                )
                signal.throwIfAborted()
                return result
              } catch {
                return {
                  content: [
                    { type: 'text' as const, text: 'MCP 도구 호출을 완료하지 못했습니다.' }
                  ],
                  isError: true
                }
              } finally {
                calls.delete(revoked)
                activeCalls--
              }
            }
          )
        }
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          enableJsonResponse: true,
          onsessioninitialized: (key) => {
            sessions.set(key, { id, server, transport: transport!, controller })
          }
        })
        server.server.onclose = () => {
          controller.abort()
          if (transport?.sessionId) sessions.delete(transport.sessionId)
        }
        await server.connect(transport)
        lifetime.signal.throwIfAborted()
        await transport.handleRequest(req, res, body)
        if (!transport.sessionId) await server.close()
      } catch {
        controller.abort()
        await server.close().catch(() => undefined)
        if (!res.headersSent) reject(res, 500)
        else res.end()
      } finally {
        pendingSessions--
        if (lifetime.signal.aborted) await server.close().catch(() => undefined)
      }
    }
    const listener = createServer((req, res) => {
      void handle(req, res).catch(() => {
        if (!res.headersSent) reject(res, 400)
        else res.end()
      })
    })
    try {
      await new Promise<void>((resolve, reject) => {
        listener.once('error', reject)
        listener.listen(0, '127.0.0.1', () => {
          listener.removeListener('error', reject)
          resolve()
        })
      })
    } catch (error) {
      unsubscribe()
      throw error
    }
    const address = listener.address()
    if (!address || typeof address === 'string') throw new Error('MCP listener unavailable')
    host = `127.0.0.1:${address.port}`
    getLogger().child('mcp').debug('managed-mcp.bridge.open', { id: trace })
    for (const id of snapshot.plugins.keys())
      endpoints.set(id, { url: `http://${host}/mcp/${encodeURIComponent(id)}`, token })
    let closing: Promise<void> | undefined
    return {
      references: 0,
      lease: {
        endpoints,
        release: () =>
          (closing ??= (async () => {
            lifetime.abort()
            unsubscribe()
            await Promise.allSettled(
              [...sessions.values()].map((entry) => {
                entry.controller.abort()
                return entry.server.close()
              })
            )
            sessions.clear()
            await new Promise<void>((resolve) => {
              listener.close(() => resolve())
              listener.closeAllConnections()
            })
            getLogger().child('mcp').debug('managed-mcp.bridge.close', { id: trace })
          })())
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true
    const pending = [...this.generations.values()]
    this.generations.clear()
    await Promise.allSettled(pending.map(async (flight) => (await flight).lease.release()))
  }
}
