import { describe, expect, it } from 'vitest'
import type { RuntimeToolContribution, RuntimeToolServer } from '../../adapters/runtime-tools'
import type { AuthBindingInfo } from '../../../shared/ipc'
import { AuthRegistry } from './registry'
import {
  PluginHost,
  type ConnectorPort,
  type LogoutPort,
  type RuntimeToolSink
} from './plugin-host'

type ConnectionInput = { id: string; connectorId: string; bindingId: string }

class FakeConnectorPort implements ConnectorPort {
  readonly connectCalls: ConnectionInput[] = []
  readonly stopCalls: string[] = []
  readonly invokeCalls: Array<{ connectionId: string; operation: string }> = []
  status: { health: 'ready' | 'error'; message?: string } = { health: 'ready' }
  connectError: Error | null = null
  stopError: Error | null = null

  async connect(input: ConnectionInput): Promise<{ health: 'ready' | 'error'; message?: string }> {
    this.connectCalls.push(input)
    if (this.connectError) throw this.connectError
    return this.status
  }

  async invoke(
    connectionId: string,
    request: { operation: string }
  ): Promise<{ ok: true; data: unknown }> {
    this.invokeCalls.push({ connectionId, operation: request.operation })
    return { ok: true, data: null }
  }

  async stopByBinding(bindingId: string): Promise<void> {
    this.stopCalls.push(bindingId)
    if (this.stopError) throw this.stopError
  }
}

class FakeRuntimeToolSink implements RuntimeToolSink {
  readonly servers = new Map<string, RuntimeToolServer>()
  readonly removed: string[] = []
  failAtAdd: number | null = null
  private addCount = 0

  add(server: RuntimeToolServer): void {
    this.addCount += 1
    if (this.failAtAdd === this.addCount) throw new Error('sink add failed')
    this.servers.set(server.descriptor.id, server)
  }

  remove(serverId: string): void {
    this.removed.push(serverId)
    this.servers.delete(serverId)
  }
}

class FakeLogoutPort implements LogoutPort {
  readonly requests: Array<{ bindingId: string; cascade: boolean }> = []
  onLogout: ((bindingId: string) => Promise<void>) | null = null

  async logout(bindingId: string, cascade: boolean): Promise<void> {
    this.requests.push({ bindingId, cascade })
    await this.onLogout?.(bindingId)
  }
}

function binding(id: string, overrides: Partial<AuthBindingInfo> = {}): AuthBindingInfo {
  return {
    id,
    pluginId: 'plugin-a',
    providerId: 'provider-a',
    target: { kind: 'connector', connectorId: 'connector-a', connectionId: 'connection-a' },
    mechanism: 'api_key',
    artifact: { kind: 'vault_credential', handleId: `vault-${id}`, credentialKind: 'api_key' },
    status: 'valid',
    createdAt: 1,
    ...overrides
  }
}

function contribution(
  id: string,
  connectorId: string,
  names: readonly string[],
  inspect?: (ctx: Parameters<RuntimeToolContribution['create']>[0]) => void
): RuntimeToolContribution {
  return {
    descriptor: {
      id,
      pluginId: 'plugin-a',
      connectorId,
      apiVersion: 1,
      tools: names.map((name) => ({ name, description: `${name} description` }))
    },
    create: (ctx) => {
      inspect?.(ctx)
      return names.map((name) => ({
        name,
        inputSchema: {},
        handler: (input) => ctx.invoke(name, input)
      }))
    }
  }
}

function registryWith(...tools: RuntimeToolContribution[]): AuthRegistry {
  const registry = new AuthRegistry()
  registry.register({
    manifest: {
      schemaVersion: 1,
      id: 'plugin-a',
      version: '1.0.0',
      contributes: {
        connectors: ['connector-a', 'connector-b'].map((connectorId) => ({
          id: connectorId,
          apiVersion: 1,
          label: connectorId,
          acceptedAuthProviders: ['provider-a'],
          baseUrl: `https://${connectorId}.example.invalid`,
          presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
        })),
        runtimeTools: tools.map((tool) => ({
          id: tool.descriptor.id,
          connectorId: tool.descriptor.connectorId,
          apiVersion: 1,
          tools: tool.descriptor.tools
        }))
      }
    },
    connectors: ['connector-a', 'connector-b'].map((connectorId) => ({
      descriptor: {
        id: connectorId,
        pluginId: 'plugin-a',
        apiVersion: 1 as const,
        label: connectorId,
        acceptedAuthProviders: ['provider-a'],
        baseUrl: `https://${connectorId}.example.invalid`,
        presentation: {
          location: 'header' as const,
          name: 'Authorization',
          scheme: 'Bearer' as const
        }
      },
      start: async () => ({ health: 'ready' as const }),
      invoke: async () => ({ ok: true as const, data: null }),
      stop: async () => undefined
    })),
    runtimeTools: tools
  })
  return registry
}

function createHost(
  bindings: Map<string, AuthBindingInfo>,
  tools: RuntimeToolContribution[] = [contribution('server-a', 'connector-a', ['read-item'])]
): {
  host: PluginHost
  connectors: FakeConnectorPort
  sink: FakeRuntimeToolSink
  logout: FakeLogoutPort
} {
  const connectors = new FakeConnectorPort()
  const sink = new FakeRuntimeToolSink()
  const logout = new FakeLogoutPort()
  const host = new PluginHost({
    registry: registryWith(...tools),
    bindings: { getBinding: (id) => bindings.get(id) },
    connectors,
    logout,
    runtimeTools: sink,
    logger: () => undefined
  })
  return { host, connectors, sink, logout }
}

describe('PluginHost', () => {
  it.each([
    ['missing binding', undefined],
    ['invalid binding', binding('binding-a', { status: 'expired' })],
    [
      'application binding',
      binding('binding-a', { target: { kind: 'application', applicationId: 'orca' } })
    ],
    [
      'connector mismatch',
      binding('binding-a', {
        target: { kind: 'connector', connectorId: 'connector-b', connectionId: 'connection-a' }
      })
    ],
    ['provider not accepted', binding('binding-a', { providerId: 'provider-b' })]
  ] as const)('rejects %s before starting a connector', async (_case, candidate) => {
    const bindings = new Map<string, AuthBindingInfo>()
    if (candidate) bindings.set(candidate.id, candidate)
    const { host, connectors } = createHost(bindings)

    await expect(
      host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    ).rejects.toThrow()
    expect(connectors.connectCalls).toEqual([])
  })

  it('uses the binding target connection ID and registers every matching static tool server', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const tools = [
      contribution('server-a', 'connector-a', ['read-item']),
      contribution('server-b', 'connector-a', ['write-item'])
    ]
    const { host, connectors, sink } = createHost(bindings, tools)

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })

    expect(connectors.connectCalls).toEqual([
      { id: 'connection-a', connectorId: 'connector-a', bindingId: 'binding-a' }
    ])
    expect([...sink.servers.keys()]).toEqual(['server-a', 'server-b'])
    expect(host.list()).toContainEqual(
      expect.objectContaining({ connectorId: 'connector-a', connected: true })
    )
  })

  it('keeps different static connectors independent while preserving the first same-connector connection', async () => {
    const bindings = new Map([
      ['binding-a', binding('binding-a')],
      [
        'binding-b',
        binding('binding-b', {
          target: { kind: 'connector', connectorId: 'connector-b', connectionId: 'connection-b' }
        })
      ]
    ])
    const { host, connectors, sink } = createHost(bindings, [
      contribution('server-a', 'connector-a', ['read-item']),
      contribution('server-b', 'connector-b', ['read-other'])
    ])

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    await expect(
      host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    ).rejects.toThrow(/already connected/i)
    await host.connect({ connectorId: 'connector-b', bindingId: 'binding-b' })

    expect(connectors.connectCalls).toHaveLength(2)
    expect([...sink.servers.keys()]).toEqual(['server-a', 'server-b'])
  })

  it('limits factory context to four capabilities and fixes invocation to its own connection', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    let contextKeys: string[] = []
    const { host, connectors, sink } = createHost(bindings, [
      contribution('server-a', 'connector-a', ['read-item'], (ctx) => {
        contextKeys = Object.keys(ctx).sort()
      })
    ])

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    await sink.servers.get('server-a')?.implementations[0]?.handler({ item: 'one' })

    expect(contextKeys).toEqual(['connectionId', 'invoke', 'logger', 'signal'])
    expect(connectors.invokeCalls).toEqual([
      { connectionId: 'connection-a', operation: 'read-item' }
    ])
  })

  it.each([
    ['missing', ['read-item'], []],
    ['extra', ['read-item'], ['read-item', 'write-item']],
    ['duplicate', ['read-item', 'write-item'], ['read-item', 'read-item']]
  ] as const)(
    'rolls back a %s factory name drift without removing its valid binding',
    async (_case, declared, actual) => {
      const bindings = new Map([['binding-a', binding('binding-a')]])
      const tool = contribution('server-a', 'connector-a', declared)
      tool.create = (ctx) =>
        actual.map((name) => ({
          name,
          inputSchema: {},
          handler: (input) => ctx.invoke(name, input)
        }))
      const { host, connectors, sink } = createHost(bindings, [tool])

      await expect(
        host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
      ).rejects.toThrow(/runtime tool/i)

      expect(sink.servers).toEqual(new Map())
      expect(host.list()[0]).toEqual(expect.objectContaining({ connected: false }))
      expect(connectors.stopCalls).toEqual(['binding-a'])
      expect(bindings.get('binding-a')).toEqual(expect.objectContaining({ status: 'valid' }))
    }
  )

  it('rolls back connector, factory, and sink failures so the same valid binding can retry', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const tool = contribution('server-a', 'connector-a', ['read-item'])
    const { host, connectors, sink } = createHost(bindings, [tool])

    connectors.status = { health: 'error' }
    await expect(
      host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    ).rejects.toThrow()
    tool.create = () => {
      throw new Error('factory failed')
    }
    connectors.status = { health: 'ready' }
    await expect(
      host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    ).rejects.toThrow()
    tool.create = (ctx) => [
      { name: 'read-item', inputSchema: {}, handler: (input) => ctx.invoke('read-item', input) }
    ]
    sink.failAtAdd = 1
    await expect(
      host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    ).rejects.toThrow()

    sink.failAtAdd = null
    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })

    expect(host.list()[0]).toEqual(expect.objectContaining({ connected: true }))
    expect(sink.servers.has('server-a')).toBe(true)
    expect(connectors.stopCalls).toEqual(['binding-a', 'binding-a', 'binding-a'])
  })

  it('aborts an in-flight connection when its binding ends and never exposes a late tool server', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    let resolveConnect: ((status: { health: 'ready' }) => void) | null = null
    const { host, connectors, sink } = createHost(bindings)
    connectors.connect = async (input) => {
      connectors.connectCalls.push(input)
      return new Promise((resolve) => {
        resolveConnect = resolve
      })
    }

    const connecting = host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    await host.onBindingsEnded(['binding-a'])
    resolveConnect?.({ health: 'ready' })

    await expect(connecting).rejects.toThrow()
    expect(sink.servers).toEqual(new Map())
    expect(host.list()[0]).toEqual(expect.objectContaining({ connected: false }))
  })

  it('uses logout callback cleanup for explicit disconnect and always removes cascade servers after stop failure', async () => {
    const bindings = new Map([
      ['binding-a', binding('binding-a')],
      [
        'binding-b',
        binding('binding-b', {
          target: { kind: 'connector', connectorId: 'connector-b', connectionId: 'connection-b' }
        })
      ]
    ])
    const contexts: AbortSignal[] = []
    const { host, connectors, logout, sink } = createHost(bindings, [
      contribution('server-a', 'connector-a', ['read-item'], (ctx) => contexts.push(ctx.signal)),
      contribution('server-b', 'connector-b', ['read-other'], (ctx) => contexts.push(ctx.signal))
    ])
    logout.onLogout = (bindingId) => host.onBindingsEnded([bindingId])

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    await host.connect({ connectorId: 'connector-b', bindingId: 'binding-b' })
    await host.disconnect({ connectorId: 'connector-a' })
    connectors.stopError = new Error('stop failed')
    await host.onBindingsEnded(['binding-b', 'binding-a'])
    await host.onBindingsEnded(['binding-b', 'binding-a'])

    expect(logout.requests).toEqual([{ bindingId: 'binding-a', cascade: false }])
    expect([...sink.servers.keys()]).toEqual([])
    expect(contexts.every((signal) => signal.aborted)).toBe(true)
    expect(connectors.stopCalls).toEqual(['binding-a', 'binding-b'])
    expect(host.list()).toEqual([
      expect.objectContaining({ connectorId: 'connector-a', connected: false }),
      expect.objectContaining({ connectorId: 'connector-b', connected: false })
    ])
  })
})
