import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { expect, it, vi } from 'vitest'
import type { ManagedMcpPlugin, ManagedMcpSnapshot } from '../../common/managed-mcp'
import { OpenCodeManagedConnections } from './managed-connections'
import { managedMcpAlias } from './managed-mcp'

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
