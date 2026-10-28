import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openCodeDiscovery } from '../adapters/opencode/v1/discovery-cache'
import { expect, it, vi } from 'vitest'
import { OpenCodeAdapter } from '../adapters/opencode/v1/adapter'
import { createManagedMcp } from './managed-mcp'
import { createPluginBinding } from './deployment/plugins'
import type { PluginAuth } from '../contracts/auth'
import type { OpenCodeServer } from '../adapters/opencode/implementation'
import type { OrcaMcpConfig } from '../adapters/common/mcp-config'
import { managedMcpAlias } from '../adapters/opencode/v1/managed-mcp'

it('shares generations and releases only owned resources', async () => {
  let users: OrcaMcpConfig = { user: { command: 'distinct command', env: { TOKEN: '${TOKEN}' } } }
  const plugin = createPluginBinding({
    auth: {
      authId: 'docs',
      snapshot: () => ({ status: 'valid', credentialRevision: 1 })
    } as PluginAuth,
    server: {
      descriptor: {
        id: 'docs-server',
        connectorId: 'docs',
        executionScope: 'application',
        tools: []
      },
      implementations: []
    },
    registry: { add: () => {}, remove: () => {} }
  })
  const managed = createManagedMcp(
    { enabledConfig: () => users, resolver: () => () => 'secret-0288-lifecycle' },
    [plugin]
  )
  const profiles = new Map<string, { port: number; mcp: Record<string, unknown>; owners: number }>()
  const inputs: { config: Record<string, unknown>; env?: Record<string, string> }[] = []
  let fail = false
  const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>()
  const server: OpenCodeServer = {
    acquire: async (config = {}, env) => {
      inputs.push({ config, env })
      if (fail) throw new Error('fixture acquisition failed')
      const key = JSON.stringify([config, env])
      let profile = profiles.get(key)
      if (!profile) {
        profile = {
          port: 24000 + profiles.size,
          mcp: config.mcp as Record<string, unknown>,
          owners: 0
        }
        profiles.set(key, profile)
      }
      profile.owners++
      const owned = profile
      let released = false
      return {
        url: `http://127.0.0.1:${profile.port}`,
        headers: {},
        release: () => {
          if (!released) {
            released = true
            owned.owners--
          }
        }
      }
    },
    installed: async () => ({ installed: true }),
    close: vi.fn()
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.pathname === '/global/event')
      return new Response(
        new ReadableStream({
          start(controller) {
            streams.set(url.port, controller)
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ directory: 'global', payload: { type: 'server.connected', properties: {} } })}\n\n`
              )
            )
            request.signal.addEventListener(
              'abort',
              () => {
                try {
                  controller.close()
                } catch {
                  /* already closed */
                }
              },
              { once: true }
            )
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    if (url.pathname === '/instance/dispose')
      streams
        .get(url.port)
        ?.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ directory: url.searchParams.get('directory'), payload: { type: 'server.instance.disposed', properties: {} } })}\n\n`
          )
        )
    const profile = [...profiles.values()].find((entry) => String(entry.port) === url.port)!
    const data =
      url.pathname === '/mcp'
        ? {
            native: { status: 'connected' },
            ...Object.fromEntries(
              Object.keys(profile.mcp).map((id) => [id, { status: 'connected' }])
            )
          }
        : {}
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })
  }
  const adapter = new OpenCodeAdapter(
    server,
    fetchImpl,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      snapshot: () => managed.source.snapshot(),
      acquire: (snapshot) => managed.mcpBridge.acquire(snapshot)
    }
  )
  const env = { XDG_CONFIG_HOME: 'C:/orca-managed-mcp-lifecycle-empty' }
  let a: Awaited<ReturnType<typeof adapter.client>> | undefined, b: typeof a, c: typeof a
  try {
    a = await adapter.client({}, env, 'C:/orca-managed-mcp-A')
    b = await adapter.client({}, env, 'C:/orca-managed-mcp-B')
    expect(profiles.size).toBe(1)
    expect([...profiles.values()][0].owners).toBe(1)
    expect(inputs[0].config).toHaveProperty('mcp')
    expect(Object.keys(inputs[0].config.mcp as object)).toHaveLength(2)
    expect(Object.values(inputs[0].env!)).toContain('secret-0288-lifecycle')
    expect(JSON.stringify(inputs[0].config)).not.toContain('secret-0288-lifecycle')
    const endpoint = Object.values(inputs[0].env!).find((value) =>
      value.startsWith('http://127.0.0.1:')
    )!
    await a.release()
    await a.release()
    expect([...profiles.values()][0].owners).toBe(1)
    expect((await fetch(endpoint)).status).toBe(401)
    const connected = await b.mcp(new AbortController().signal)
    expect(
      connected
        .filter((item) => item.origin === 'orca')
        .map((item) => item.managedSource?.kind)
        .sort()
    ).toEqual(['builtin', 'user'])
    expect(JSON.stringify(connected)).not.toContain('secret-0288-lifecycle')
    users = {}
    managed.source.refresh()
    expect((await b.mcp(new AbortController().signal)).map((item) => item.id)).toEqual(['native'])
    c = await adapter.client({}, env, 'C:/orca-managed-mcp-C')
    expect(profiles.size).toBe(2)
    expect([...profiles.values()][0].owners).toBe(1)
    await c.release()
    c = undefined
    await b.release()
    b = undefined
    adapter.extensionsChanged()
    await vi.waitFor(async () => {
      await expect(fetch(endpoint)).rejects.toThrow()
    })
    const turn = adapter.sendMessage({
      sessionId: 'existing',
      cwd: 'C:/orca-managed-mcp-turn',
      text: 'turn',
      env,
      extensions: {
        skills: [],
        hooks: { normalized: {} },
        managedMcp: {
          revision: 99,
          users: { 'turn-only': { command: 'turn-only-command' } },
          plugins: new Map()
        }
      }
    })
    const iterator = turn.eventBatches[Symbol.asyncIterator]()
    try {
      await iterator.next()
      expect(Object.keys(inputs.at(-1)!.config.mcp as object)).toEqual([
        managedMcpAlias('user', 'turn-only')
      ])
      expect(Object.values(inputs.at(-1)!.env!)).toContain('turn-only-command')
    } finally {
      turn.close()
      await iterator.return?.()
    }
    fail = true
    await expect(adapter.client({}, env, 'C:/orca-managed-mcp-failure')).rejects.toThrow(
      'fixture acquisition'
    )
    const failedEndpoint = Object.values(inputs.at(-1)!.env!).find((value) =>
      value.startsWith('http://127.0.0.1:')
    )!
    await expect(fetch(failedEndpoint)).rejects.toThrow()
  } finally {
    await a?.release()
    await b?.release()
    await c?.release()
    adapter.close()
    await managed.mcpBridge.close()
  }
})


it('checks native identity collisions in each actual adapter environment before projection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-collision-cache-'))
  const cwd = join(root, 'project'), first = join(root, 'one'), second = join(root, 'two')
  const alias = managedMcpAlias('user', 'stored')
  const managed = createManagedMcp({ enabledConfig: () => ({ stored: { command: 'managed' } }), resolver: () => () => undefined }, [])
  const acquire = vi.fn<OpenCodeServer['acquire']>(async () => ({ url: 'http://fixture.test', headers: {}, release: vi.fn() }))
  const adapter = new OpenCodeAdapter({ acquire, installed: vi.fn(), close: vi.fn() }, vi.fn(), undefined, undefined, undefined, undefined, {
    snapshot: managed.source.snapshot, acquire: (snapshot) => managed.mcpBridge.acquire(snapshot)
  })
  try {
    await mkdir(join(cwd, '.git'), { recursive: true })
    await mkdir(join(first, 'opencode'), { recursive: true })
    await mkdir(join(second, 'opencode'), { recursive: true })
    const config = join(first, 'opencode', 'opencode.json')
    await writeFile(config, JSON.stringify({ mcp: { [alias]: { type: 'local', command: ['native'] } } }))
    const a = await adapter.client({}, { XDG_CONFIG_HOME: first }, cwd)
    const b = await adapter.client({}, { XDG_CONFIG_HOME: second }, cwd)
    expect(acquire.mock.calls[0][0]?.mcp).not.toHaveProperty(alias)
    expect(acquire.mock.calls[1][0]?.mcp).toHaveProperty(alias)
    await writeFile(config, '{}')
    openCodeDiscovery.invalidate()
    const c = await adapter.client({}, { XDG_CONFIG_HOME: first }, cwd)
    expect(acquire.mock.calls[2][0]?.mcp).toHaveProperty(alias)
    await Promise.all([a.release(), b.release(), c.release()])
  } finally {
    adapter.close()
    await managed.mcpBridge.close()
    openCodeDiscovery.invalidate()
    await rm(root, { recursive: true, force: true })
  }
})
