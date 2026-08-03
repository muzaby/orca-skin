import type { RuntimeToolContribution, RuntimeToolServer } from '../../adapters/runtime-tools'
import type {
  ConnectorRequest,
  ConnectorResult,
  ConnectorRuntimeV1,
  ConnectorStatus
} from '../../contracts/connector-plugin'
import type { AuthBindingInfo, AuthLogoutOutcome, PluginConnectorInfo } from '../../../shared/ipc'

export interface ConnectorPort {
  connect(
    input: { id: string; connectorId: string; bindingId: string },
    signal?: AbortSignal
  ): Promise<ConnectorStatus>
  invoke(
    connectionId: string,
    request: ConnectorRequest,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<ConnectorResult>
  stopByBinding(bindingId: string): Promise<void>
}

export interface BindingLookup {
  getBinding(bindingId: string): AuthBindingInfo | undefined
}

export interface LogoutPort {
  logout(bindingId: string, cascade: boolean): Promise<AuthLogoutOutcome>
}

export interface RuntimeToolSink {
  add(server: RuntimeToolServer): void
  remove(serverId: string): void
}

interface PluginRegistry {
  getConnector(connectorId: string): ConnectorRuntimeV1 | undefined
  listConnectors(): ConnectorRuntimeV1[]
  listRuntimeToolsForConnector(connectorId: string): RuntimeToolContribution[]
}

export interface PluginHostDeps {
  registry: PluginRegistry
  bindings: BindingLookup
  connectors: ConnectorPort
  logout: LogoutPort
  runtimeTools: RuntimeToolSink
  logger?: (message: string, meta?: Record<string, unknown>) => void
}

interface ActiveConnection {
  connectorId: string
  bindingId: string
  connectionId: string
  bindingFingerprint: BindingFingerprint
  controller: AbortController
  serverIds: string[]
  ready: boolean
  cleanup?: Promise<void>
}

interface BindingFingerprint {
  bindingId: string
  pluginId: string
  providerId: string
  connectorId: string
  connectionId: string
}

// 인증 binding과 connector runtime을 조립하는 auth-platform 내부 lifecycle coordinator.
// connector/extensions의 구현체를 모르고 구조적 port만 받으므로 feature 경계를 넘지 않는다.
export class PluginHost {
  private readonly activeByConnector = new Map<string, ActiveConnection>()

  constructor(private readonly deps: PluginHostDeps) {}

  list(): PluginConnectorInfo[] {
    return this.deps.registry.listConnectors().map((connector) => ({
      connectorId: connector.descriptor.id,
      label: connector.descriptor.label,
      origin: connector.descriptor.baseUrl,
      pluginId: connector.descriptor.pluginId,
      acceptedAuthProviders: [...connector.descriptor.acceptedAuthProviders],
      connected: this.activeByConnector.get(connector.descriptor.id)?.ready === true
    }))
  }

  async connect(input: { connectorId: string; bindingId: string }): Promise<void> {
    const connector = this.deps.registry.getConnector(input.connectorId)
    if (!connector) throw new Error(`unknown connector: ${input.connectorId}`)
    if (this.activeByConnector.has(input.connectorId)) {
      throw new Error(`connector already connected: ${input.connectorId}`)
    }

    const binding = this.requireValidBinding(input.bindingId, connector)
    const active: ActiveConnection = {
      connectorId: input.connectorId,
      bindingId: binding.id,
      connectionId: binding.target.connectionId,
      bindingFingerprint: fingerprint(binding),
      controller: new AbortController(),
      serverIds: [],
      ready: false
    }
    // await 전에 pending record를 넣어 concurrent connect도 같은 connector invariant를 지킨다.
    this.activeByConnector.set(active.connectorId, active)

    try {
      const status = await this.deps.connectors.connect(
        {
          id: active.connectionId,
          connectorId: active.connectorId,
          bindingId: active.bindingId
        },
        active.controller.signal
      )
      if (status.health !== 'ready') {
        throw new Error(status.message ?? `connector is not ready: ${active.connectorId}`)
      }
      if (
        this.activeByConnector.get(active.connectorId) !== active ||
        active.controller.signal.aborted
      ) {
        throw new Error(`binding ended during connector start: ${active.bindingId}`)
      }
      // 시작을 기다리는 동안 binding이 만료/교체되었는지 다시 확인한다. principal 같은
      // 표시용 refresh는 허용하지만 connection/provider/plugin이 바뀐 새 binding은 거부한다.
      const currentBinding = this.requireValidBinding(active.bindingId, connector)
      if (!sameFingerprint(active.bindingFingerprint, fingerprint(currentBinding))) {
        throw new Error(`binding changed during connector start: ${active.bindingId}`)
      }

      const servers = this.deps.registry
        .listRuntimeToolsForConnector(active.connectorId)
        .map((contribution) => this.makeServer(contribution, active))
      for (const server of servers) this.assertImplementationNames(server)
      for (const server of servers) {
        active.serverIds.push(server.descriptor.id)
        this.deps.runtimeTools.add(server)
      }
      active.ready = true
    } catch (error) {
      if (this.activeByConnector.get(active.connectorId) === active) {
        await this.cleanup(active)
      }
      throw error
    }
  }

  async disconnect(input: { connectorId: string }): Promise<AuthLogoutOutcome> {
    const active = this.activeByConnector.get(input.connectorId)
    if (!active) throw new Error(`connector is not connected: ${input.connectorId}`)
    // cleanup은 broker의 ended-binding callback만 한다. 여기서 별도 경로를 만들면
    // provider logout 실패/cascade와 명시 disconnect가 달라진다.
    return this.deps.logout.logout(active.bindingId, false)
  }

  async onBindingsEnded(bindingIds: readonly string[]): Promise<void> {
    const ended = new Set(bindingIds)
    const victims = [...this.activeByConnector.values()].filter((active) =>
      ended.has(active.bindingId)
    )
    await Promise.all(victims.map((active) => this.cleanup(active)))
  }

  private requireValidBinding(
    bindingId: string,
    connector: ConnectorRuntimeV1
  ): AuthBindingInfo & {
    target: { kind: 'connector'; connectorId: string; connectionId: string }
  } {
    const binding = this.deps.bindings.getBinding(bindingId)
    if (!binding) throw new Error(`unknown binding: ${bindingId}`)
    if (binding.status !== 'valid') throw new Error(`binding is not valid: ${bindingId}`)
    const target = binding.target
    if (target.kind !== 'connector')
      throw new Error(`binding target is not a connector: ${bindingId}`)
    if (target.connectorId !== connector.descriptor.id) {
      throw new Error(`binding target does not match connector: ${bindingId}`)
    }
    if (!connector.descriptor.acceptedAuthProviders.includes(binding.providerId)) {
      throw new Error(`binding provider is not accepted: ${binding.providerId}`)
    }
    return { ...binding, target }
  }

  private makeServer(
    contribution: RuntimeToolContribution,
    active: ActiveConnection
  ): RuntimeToolServer {
    const implementations = contribution.create({
      connectionId: active.connectionId,
      invoke: (operation, params) => {
        if (active.controller.signal.aborted) {
          return Promise.resolve({
            ok: false,
            message: 'connector invocation was cancelled',
            health: 'error' as const
          })
        }
        return this.deps.connectors.invoke(
          active.connectionId,
          {
            operation,
            ...(params ? { params } : {})
          },
          undefined,
          active.controller.signal
        )
      },
      logger: (message, meta) =>
        this.deps.logger?.(message, {
          connectorId: active.connectorId,
          ...(meta !== undefined ? { meta } : {})
        }),
      signal: active.controller.signal
    })
    return { descriptor: contribution.descriptor, implementations }
  }

  private assertImplementationNames(server: RuntimeToolServer): void {
    const declared = server.descriptor.tools.map((tool) => tool.name).sort()
    const implemented = server.implementations.map((tool) => tool.name).sort()
    if (
      declared.length !== implemented.length ||
      declared.some((name, index) => name !== implemented[index])
    ) {
      throw new Error(`runtime tool implementation names drift: ${server.descriptor.id}`)
    }
  }

  private async cleanup(active: ActiveConnection): Promise<void> {
    if (active.cleanup) return active.cleanup
    active.cleanup = this.cleanupOnce(active)
    return active.cleanup
  }

  private async cleanupOnce(active: ActiveConnection): Promise<void> {
    active.controller.abort()
    try {
      await this.deps.connectors.stopByBinding(active.bindingId)
    } catch (error) {
      this.deps.logger?.('plugin-host.connector.stop.failed', {
        connectorId: active.connectorId,
        bindingId: active.bindingId,
        message: String(error)
      })
    } finally {
      for (const serverId of active.serverIds) this.deps.runtimeTools.remove(serverId)
      active.serverIds = []
      active.ready = false
      if (this.activeByConnector.get(active.connectorId) === active) {
        this.activeByConnector.delete(active.connectorId)
      }
    }
  }
}

function fingerprint(
  binding: AuthBindingInfo & {
    target: { kind: 'connector'; connectorId: string; connectionId: string }
  }
): BindingFingerprint {
  return {
    bindingId: binding.id,
    pluginId: binding.pluginId,
    providerId: binding.providerId,
    connectorId: binding.target.connectorId,
    connectionId: binding.target.connectionId
  }
}

function sameFingerprint(left: BindingFingerprint, right: BindingFingerprint): boolean {
  return (
    left.bindingId === right.bindingId &&
    left.pluginId === right.pluginId &&
    left.providerId === right.providerId &&
    left.connectorId === right.connectorId &&
    left.connectionId === right.connectionId
  )
}
