import { describe, expect, it } from 'vitest'
import type {
  RuntimeToolContribution,
  RuntimeToolResult,
  RuntimeToolServer
} from '../../adapters/runtime-tools'
import type { AuthBindingInfo, AuthLogoutOutcome } from '../../../shared/ipc'
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
  readonly connectSignals: AbortSignal[] = []
  readonly stopCalls: string[] = []
  readonly invokeCalls: Array<{ connectionId: string; operation: string }> = []
  readonly invokeSignals: AbortSignal[] = []
  status: { health: 'ready' | 'error'; message?: string } = { health: 'ready' }
  connectError: Error | null = null
  stopError: Error | null = null

  async connect(
    input: ConnectionInput,
    signal?: AbortSignal
  ): Promise<{ health: 'ready' | 'error'; message?: string }> {
    this.connectCalls.push(input)
    if (signal) this.connectSignals.push(signal)
    if (this.connectError) throw this.connectError
    return this.status
  }

  async invoke(
    connectionId: string,
    request: { operation: string },
    _timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<{ ok: true; data: unknown }> {
    this.invokeCalls.push({ connectionId, operation: request.operation })
    if (signal) this.invokeSignals.push(signal)
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
  outcome: AuthLogoutOutcome = { kind: 'logged_out', endedBindingIds: [] }

  async logout(bindingId: string, cascade: boolean): Promise<AuthLogoutOutcome> {
    this.requests.push({ bindingId, cascade })
    await this.onLogout?.(bindingId)
    return this.outcome
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
        handler: async (input) => toResult(await ctx.invoke(name, input))
      }))
    }
  }
}

// 계약: handler 는 MCP 도구 결과를 돌려준다. 연결이 끊긴 뒤의 호출은 ctx.invoke 가 던지므로
// 여기까지 오지 않는다(SDK 가 isError 로 변환).
function toResult(raw: unknown): RuntimeToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(raw) }] }
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

  // 0164 — 사용자가 ID/비밀번호로 붙여놓고도 화면에서 그 사실을 확인할 수 없었다.
  it('연결되면 무엇으로 연결됐는지를 싣는다', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host } = createHost(bindings, [contribution('server-a', 'connector-a', ['read-item'])])

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })

    const info = host.list().find((item) => item.connectorId === 'connector-a')
    expect(info?.connectedProviderId).toBe(binding('binding-a').providerId)
  })

  it('미연결이면 connectedProviderId 가 없다', () => {
    const { host } = createHost(new Map(), [contribution('server-a', 'connector-a', ['read-item'])])
    const info = host.list().find((item) => item.connectorId === 'connector-a')
    expect(info?.connected).toBe(false)
    expect(info).not.toHaveProperty('connectedProviderId')
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
          handler: async (input) => toResult(await ctx.invoke(name, input))
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
      {
        name: 'read-item',
        inputSchema: {},
        handler: async (input) => toResult(await ctx.invoke('read-item', input))
      }
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
    const { host, connectors, sink } = createHost(bindings)
    connectors.connect = async (input, signal) => {
      connectors.connectCalls.push(input)
      if (signal) connectors.connectSignals.push(signal)
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve({ health: 'error' }), { once: true })
      })
    }

    const connecting = host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    expect(connectors.connectSignals).toHaveLength(1)
    await host.onBindingsEnded(['binding-a'])
    expect(connectors.connectSignals[0]?.aborted).toBe(true)

    await expect(connecting).rejects.toThrow()
    expect(sink.servers).toEqual(new Map())
    expect(host.list()[0]).toEqual(expect.objectContaining({ connected: false }))
  })

  it('rolls back a late-ready connector when the binding ID is replaced with a new connection target', async () => {
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
    bindings.set(
      'binding-a',
      binding('binding-a', {
        target: { kind: 'connector', connectorId: 'connector-a', connectionId: 'connection-new' }
      })
    )
    const completeConnect = resolveConnect as ((status: { health: 'ready' }) => void) | null
    if (!completeConnect) throw new Error('expected pending connector completion')
    completeConnect({ health: 'ready' })

    await expect(connecting).rejects.toThrow(/binding changed/i)
    expect(connectors.connectCalls).toEqual([
      { id: 'connection-a', connectorId: 'connector-a', bindingId: 'binding-a' }
    ])
    expect(connectors.stopCalls).toEqual(['binding-a'])
    expect(sink.servers).toEqual(new Map())
    expect(host.list()).toContainEqual(
      expect.objectContaining({ connectorId: 'connector-a', connected: false })
    )
  })

  it('accepts a refreshed binding object when its stable connection identity is unchanged', async () => {
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
    bindings.set('binding-a', binding('binding-a', { principal: { id: 'refreshed-user' } }))
    const completeConnect = resolveConnect as ((status: { health: 'ready' }) => void) | null
    if (!completeConnect) throw new Error('expected pending connector completion')
    completeConnect({ health: 'ready' })

    await expect(connecting).resolves.toBeUndefined()
    expect(sink.servers.has('server-a')).toBe(true)
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

  it('returns a failed logout outcome after the broker callback cleans up the connector', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, logout, sink } = createHost(bindings)
    logout.outcome = { kind: 'failed', message: 'provider logout failed' }
    logout.onLogout = (bindingId) => host.onBindingsEnded([bindingId])

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })

    await expect(host.disconnect({ connectorId: 'connector-a' })).resolves.toEqual({
      kind: 'failed',
      message: 'provider logout failed'
    })
    expect(sink.servers).toEqual(new Map())
  })

  it('aborts an in-flight tool invocation on explicit disconnect', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, connectors, logout, sink } = createHost(bindings)
    let resolveInvocationStarted!: () => void
    const invocationStarted = new Promise<void>((resolve) => {
      resolveInvocationStarted = resolve
    })
    connectors.invoke = async (_connectionId, _request, _timeoutMs, signal) => {
      if (signal) connectors.invokeSignals.push(signal)
      resolveInvocationStarted()
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve({ ok: true, data: null }), { once: true })
      })
    }
    logout.onLogout = (bindingId) => host.onBindingsEnded([bindingId])

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    const invocation = sink.servers.get('server-a')?.implementations[0]?.handler({})
    await invocationStarted

    expect(connectors.invokeSignals).toHaveLength(1)
    await host.disconnect({ connectorId: 'connector-a' })
    await expect(invocation).resolves.toMatchObject({ content: expect.any(Array) })
    expect(connectors.invokeSignals[0]?.aborted).toBe(true)
  })

  // 정리 뒤의 캐시된 handler 는 **던져야** 한다. 해소된 오류 객체로 돌려주면 플러그인이 그것을
  // 도구 결과로 반환할 수 있고, MCP 경계에서 `isError` 없는 빈 성공이 되어 모델이 '취소' 를
  // '성공, 결과 없음' 으로 읽는다(0158 verify r1 D5). SDK 는 예외만 isError 로 변환한다.
  it('rejects a cached runtime tool handler after explicit cleanup instead of resolving', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, connectors, logout, sink } = createHost(bindings)
    logout.onLogout = (bindingId) => host.onBindingsEnded([bindingId])

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    const handler = sink.servers.get('server-a')?.implementations[0]?.handler
    if (!handler) throw new Error('expected cached runtime tool handler')
    await host.disconnect({ connectorId: 'connector-a' })

    await expect(handler({})).rejects.toThrow(/connection is closed/i)
    expect(connectors.invokeCalls).toEqual([])
  })

  // D7 — sink.remove 가 throw 해도 정리가 끝까지 진행돼야 한다. 중단되면 runtime server 가
  // registry 에 남아 LLM 에 계속 노출되고 재연결도 거부된다.
  it('completes cleanup and allows reconnect even when the runtime tool sink throws on remove', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, connectors, sink } = createHost(bindings)
    sink.remove = () => {
      throw new Error('sink remove failed')
    }

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    await expect(host.onBindingsEnded(['binding-a'])).resolves.toBeUndefined()

    expect(host.list()[0]).toEqual(expect.objectContaining({ connected: false }))
    // 연결 레코드가 해제됐으므로 재연결이 'already connected' 로 막히지 않는다.
    await expect(
      host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    ).resolves.toBeUndefined()
    expect(connectors.connectCalls).toHaveLength(2)
  })

  it('aborts an in-flight tool invocation when a failed provider logout ends its binding', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, connectors, logout, sink } = createHost(bindings)
    let resolveInvocationStarted!: () => void
    const invocationStarted = new Promise<void>((resolve) => {
      resolveInvocationStarted = resolve
    })
    connectors.invoke = async (_connectionId, _request, _timeoutMs, signal) => {
      if (signal) connectors.invokeSignals.push(signal)
      resolveInvocationStarted()
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve({ ok: true, data: null }), { once: true })
      })
    }
    logout.outcome = { kind: 'failed', message: 'provider logout failed' }
    logout.onLogout = (bindingId) => host.onBindingsEnded([bindingId])

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    const invocation = sink.servers.get('server-a')?.implementations[0]?.handler({})
    await invocationStarted

    expect(connectors.invokeSignals).toHaveLength(1)
    await expect(host.disconnect({ connectorId: 'connector-a' })).resolves.toEqual(logout.outcome)
    await expect(invocation).resolves.toMatchObject({ content: expect.any(Array) })
    expect(connectors.invokeSignals[0]?.aborted).toBe(true)
  })

  it('aborts an in-flight tool invocation when cascade cleanup ends its binding', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, connectors, sink } = createHost(bindings)
    let resolveInvocationStarted!: () => void
    const invocationStarted = new Promise<void>((resolve) => {
      resolveInvocationStarted = resolve
    })
    connectors.invoke = async (_connectionId, _request, _timeoutMs, signal) => {
      if (signal) connectors.invokeSignals.push(signal)
      resolveInvocationStarted()
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve({ ok: true, data: null }), { once: true })
      })
    }

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    const invocation = sink.servers.get('server-a')?.implementations[0]?.handler({})
    await invocationStarted

    expect(connectors.invokeSignals).toHaveLength(1)
    await host.onBindingsEnded(['binding-a', 'binding-from-cascade'])
    await expect(invocation).resolves.toMatchObject({ content: expect.any(Array) })
    expect(connectors.invokeSignals[0]?.aborted).toBe(true)
  })

  // ── connectorId 로 부르는 표면 (0176) ────────────────────────────────────────

  it('connectorId 로 invoke 를 위임하고 미연결은 not_connected', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, connectors } = createHost(bindings)

    const beforeConnect = await host.invokeConnector('connector-a', { operation: 'quota' })
    expect(beforeConnect).toMatchObject({ ok: false })
    expect(connectors.invokeCalls).toHaveLength(0)

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    const result = await host.invokeConnector('connector-a', {
      operation: 'quota',
      params: { scope: 'month' }
    })

    expect(result).toMatchObject({ ok: true })
    expect(connectors.invokeCalls).toEqual([{ connectionId: 'connection-a', operation: 'quota' }])

    // 등록되지 않은 connector 도 같은 형태로 강등한다(던지지 않는다).
    await expect(
      host.invokeConnector('connector-zzz', { operation: 'quota' })
    ).resolves.toMatchObject({ ok: false })
  })

  it('binding 종료가 진행 중인 connectorId 호출을 끊는다', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, connectors } = createHost(bindings)
    let resolveStarted = (): void => undefined
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve
    })
    connectors.invoke = async (_connectionId, _request, _timeoutMs, signal) => {
      if (signal) connectors.invokeSignals.push(signal)
      resolveStarted()
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve({ ok: true, data: 'aborted' }), {
          once: true
        })
      })
    }

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    const invocation = host.invokeConnector('connector-a', { operation: 'quota' })
    await started
    await host.onBindingsEnded(['binding-a'])

    await expect(invocation).resolves.toMatchObject({ data: 'aborted' })
    expect(connectors.invokeSignals[0]?.aborted).toBe(true)
  })

  it('호출자 취소도 그 호출만 끊는다', async () => {
    const bindings = new Map([['binding-a', binding('binding-a')]])
    const { host, connectors } = createHost(bindings)
    const caller = new AbortController()
    let resolveStarted = (): void => undefined
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve
    })
    connectors.invoke = async (_connectionId, _request, _timeoutMs, signal) => {
      if (signal) connectors.invokeSignals.push(signal)
      resolveStarted()
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve({ ok: true, data: 'aborted' }), {
          once: true
        })
      })
    }

    await host.connect({ connectorId: 'connector-a', bindingId: 'binding-a' })
    const invocation = host.invokeConnector('connector-a', { operation: 'quota' }, caller.signal)
    await started
    caller.abort()

    await expect(invocation).resolves.toMatchObject({ data: 'aborted' })
    // 연결 자체는 살아 있다 — 다음 호출이 계속 나간다.
    expect(host.list().find((info) => info.connectorId === 'connector-a')?.connected).toBe(true)
  })
})
