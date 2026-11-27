import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { ManagedMcpPlugin, ManagedMcpSnapshot } from '../adapters/common/managed-mcp'
import { OpenCodeManagedConnections } from '../adapters/opencode/v1/managed-connections'
import { expect, it, vi } from 'vitest'
import {
  managedMcpAlias,
  mapManagedMcpResources,
  projectManagedMcp
} from '../adapters/opencode/v1/managed-mcp'
import { nativeOpenCodeEnvironment } from '../adapters/opencode/v1/native-storage'
import { openCodeServerProfile } from '../adapters/opencode/v1/server-profile'
import { resolveMcpConfig } from '../features/extensions/common/mcp/resolve'

it('preserves transports identities and native configuration', () => {
  const secret = 'secret-0288-distinct'
  const users = resolveMcpConfig(
    {
      'a-b': {
        command: 'C:\\Program Files\\node.exe',
        args: ['arg with spaces', '', 'quote"\n{file:verbatim}'],
        env: { TOKEN: '${TOKEN}' }
      },
      a_b: { type: 'http', url: 'https://http.test/path', headers: { Authorization: '${TOKEN}' } },
      '한글 space': {
        type: 'sse',
        url: 'https://sse.test/path',
        headers: { 'X-Secret': '${TOKEN}' }
      },
      missing: { command: 'missing', env: { TOKEN: '${MISSING}' } }
    },
    (name) => (name === 'TOKEN' ? secret : undefined)
  )
  expect(users.dropped).toEqual([{ name: 'missing', reason: '미해결 환경변수: MISSING' }])
  const snapshot = { revision: 4, users: users.config, plugins: new Map() }
  const native = {
    mcp: { native: { type: 'remote', url: 'https://native.test', oauth: true } },
    permission: { '*': 'ask' },
    custom: 'retained'
  }
  const before = JSON.stringify(native)
  const projection = projectManagedMcp(
    snapshot,
    { endpoints: new Map(), release: async () => {} },
    native
  )
  expect(JSON.stringify(native)).toBe(before)
  expect(projection.config.mcp).toMatchObject(native.mcp)
  const expand = (value: unknown): unknown =>
    JSON.parse(
      JSON.stringify(value).replace(/\{env:([^}]+)\}/g, (_match, key) => projection.env[key])
    )
  const projected = expand(projection.config.mcp) as Record<string, unknown>
  expect(projected[managedMcpAlias('user', 'a-b')]).toEqual({
    type: 'local',
    command: ['C:\\Program Files\\node.exe', 'arg with spaces', '', 'quote"\n{file:verbatim}'],
    environment: { TOKEN: secret },
    enabled: false
  })
  expect(projected[managedMcpAlias('user', 'a_b')]).toEqual({
    type: 'remote',
    url: 'https://http.test/path',
    headers: { Authorization: secret },
    oauth: false,
    enabled: false
  })
  expect(projected[managedMcpAlias('user', '한글 space')]).toMatchObject({
    type: 'remote',
    url: 'https://sse.test/path',
    oauth: false
  })
  expect(new Set(projection.identities.keys()).size).toBe(3)
  expect(JSON.stringify(projection.config)).not.toContain(secret)
  const environment = nativeOpenCodeEnvironment(projection.config, projection.env, {})
  expect(environment.OPENCODE_CONFIG_CONTENT).not.toContain(secret)
  expect(Object.values(environment)).toContain(secret)
  const one = openCodeServerProfile('not-a-real-executable', projection.config, projection.env)
  const two = openCodeServerProfile('not-a-real-executable', projection.config, {
    ...projection.env
  })
  expect(one.key).toBe(two.key)
  const alias = managedMcpAlias('user', 'a-b')
  const mapped = mapManagedMcpResources(
    [{ id: alias, name: alias, kind: 'mcp', enabled: true, canToggle: true, status: 'connected' }],
    projection.identities
  )
  expect(mapped[0]).toMatchObject({
    name: 'a-b',
    mentionId: alias,
    origin: 'orcinus-orca',
    managedSource: { kind: 'user', sourceId: 'a-b' },
    canToggle: false
  })
  const collided = projectManagedMcp(
    snapshot,
    { endpoints: new Map(), release: async () => {} },
    native,
    [alias]
  )
  expect(collided.failures).toEqual([{ sourceId: 'a-b', reason: 'identity-collision' }])
  expect(collided.identities.has(alias)).toBe(false)
  expect(collided.identities.size).toBe(2)
  expect(collided.config.mcp).toMatchObject(native.mcp)
})

it.each(['supported', 'unavailable', 'collision'] as const)(
  'handles late registration with %s SDK capabilities and preserves auth-independent choices',
  async (mode) => {
    const alias = managedMcpAlias('builtin', 'fixture')
    const external = managedMcpAlias('user', 'fixture')
    const initial: ManagedMcpSnapshot = { revision: 1, users: {}, plugins: new Map() }
    let current = initial
    const settings: Record<string, boolean> = {
      'managed:builtin:fixture': false,
      'managed:user:fixture': true
    }
    const release = vi.fn(async () => {})
    const runtime = {
      snapshot: () => current,
      peek: () => current,
      acquire: async () => ({
        endpoints: new Map([['tool', { url: 'http://localhost/builtin', token: 'test-lease' }]]),
        release
      })
    }
    const context = new OpenCodeManagedConnections(
      { defaults: {}, restricted: new Set(), nativeIds: [] },
      {},
      runtime,
      { global: () => settings },
      initial
    )
    const statuses: Record<string, { status: string }> =
      mode === 'collision'
        ? { [alias]: { status: 'connected' }, [external]: { status: 'connected' } }
        : {}
    const posts: string[] = []
    const client = createOpencodeClient({
      baseUrl: 'http://sdk.test',
      fetch: async (input, init) => {
        const request = new Request(input, init)
        if (request.method === 'POST') {
          const { name, config } = await request.json()
          posts.push(name)
          if (mode === 'unavailable') return Response.json({}, { status: 405 })
          expect(config.enabled).toBe(false)
          statuses[name] = { status: 'disabled' }
        }
        return Response.json(statuses)
      }
    })
    const plugin: ManagedMcpPlugin = {
      identity: { kind: 'builtin', sourceId: 'fixture', name: 'builtin', mentionId: 'fixture' },
      authorized: () => true,
      credentialRevision: () => 2,
      server: {
        descriptor: {
          id: 'tool',
          connectorId: 'fixture',
          executionScope: 'application',
          tools: []
        },
        implementations: []
      }
    }
    current = {
      revision: 2,
      users: { fixture: { type: 'http', url: 'http://localhost/external' } },
      plugins: new Map([['tool', plugin]])
    }
    try {
      expect(context.dirty()).toBe(true)
      await context.refresh(client, '/test', new AbortController().signal)
      expect(context.dirty()).toBe(false)
      expect(posts.sort()).toEqual(mode === 'collision' ? [] : [alias, external].sort())
      if (mode === 'supported') {
        expect(context.choices()).toEqual({ [alias]: false, [external]: true })
        settings['managed:builtin:fixture'] = true
        expect(context.choices()[alias]).toBe(true)
        expect(context.dirty()).toBe(false)
        expect(release).not.toHaveBeenCalled()
      } else {
        expect(context.choices()).toEqual({})
        expect(context.map([]).map((item) => item.controlReason)).toEqual([
          '이 세션에 등록되지 않은 MCP입니다.',
          '이 세션에 등록되지 않은 MCP입니다.'
        ])
        expect(release).toHaveBeenCalledOnce()
      }
    } finally {
      await context.release()
    }
    expect(release).toHaveBeenCalledOnce()
  }
)
