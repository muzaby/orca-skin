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

// connector 가 코드로 배포된 것(static)인지 사용자가 추가한 것(instance)인지 판정하는 포트
// (0161). `features/connectors` 의 인스턴스 저장소가 구조적으로 만족한다 — feature 교차
// import 없이 컴포지션 루트가 주입한다. 미주입이면 전부 static 으로 본다(기존 동작 보존).
export interface InstanceSourceLookup {
  isUserInstance(connectorId: string): boolean
}

export interface PluginHostDeps {
  registry: PluginRegistry
  bindings: BindingLookup
  connectors: ConnectorPort
  logout: LogoutPort
  runtimeTools: RuntimeToolSink
  instances?: InstanceSourceLookup
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
    return this.deps.registry.listConnectors().map((connector) => {
      const active = this.activeByConnector.get(connector.descriptor.id)
      // **무엇으로 연결됐는지** (0164). 사용자가 ID/비밀번호로 붙여놓고도 화면에서 그 사실을
      // 확인할 수 없었다. provider **id** 만 싣는다 — secret·handle 은 이 경계를 넘지 않는다.
      // 키 부재 = 미연결이다(연결되지 않았는데 방식이 표시되는 일이 없다).
      const connectedProviderId =
        active?.ready === true ? active.bindingFingerprint.providerId : undefined
      return {
        connectorId: connector.descriptor.id,
        label: connector.descriptor.label,
        origin: connector.descriptor.baseUrl,
        pluginId: connector.descriptor.pluginId,
        acceptedAuthProviders: [...connector.descriptor.acceptedAuthProviders],
        connected: active?.ready === true,
        // 미주입이면 static — UI 가 삭제 버튼을 그리지 않는 쪽으로 접힌다(fail-closed).
        source:
          this.deps.instances?.isUserInstance(connector.descriptor.id) === true
            ? ('instance' as const)
            : ('static' as const),
        ...(connectedProviderId !== undefined ? { connectedProviderId } : {})
      }
    })
  }

  // 연결돼 있으면 끊는다. 연결이 없으면 아무 일도 하지 않는다 — 인스턴스 삭제 경로가
  // "연결 여부를 모른 채" 부를 수 있어야 멱등하다(0161 `InstanceHostPort`).
  async disconnectIfConnected(connectorId: string): Promise<void> {
    if (!this.activeByConnector.has(connectorId)) return
    await this.disconnect({ connectorId })
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

  // connectorId 로 부르는 호출 표면 (0176). 지금까지 connector 를 부를 수 있는 것은 runtime
  // tool 뿐이었고(`makeServer` 의 클로저), 그래서 도구가 아닌 소비자(사용량 수집)는 닿을 길이
  // 없었다.
  //
  // **미연결은 예외가 아니라 결과다** — 부팅 직후·사내망 밖·로그아웃 후가 전부 정상 상태이고,
  // 호출자(사용량 갱신)는 그때 마지막 값을 유지해야 한다.
  async invokeConnector(
    connectorId: string,
    request: ConnectorRequest,
    signal?: AbortSignal
  ): Promise<ConnectorResult> {
    const active = this.activeByConnector.get(connectorId)
    if (!active || !active.ready || active.controller.signal.aborted) {
      return { ok: false, message: `connector is not connected: ${connectorId}` }
    }
    // 연결 종료(binding 만료·logout)와 호출자 취소(사용량 타임아웃) **둘 다** 이 호출을 끊어야
    // 한다. 둘을 하나로 접고 끝나면 리스너를 되돌린다.
    const controller = new AbortController()
    const abort = (): void => controller.abort()
    if (signal?.aborted === true) abort()
    active.controller.signal.addEventListener('abort', abort, { once: true })
    signal?.addEventListener('abort', abort, { once: true })
    try {
      return await this.deps.connectors.invoke(
        active.connectionId,
        request,
        undefined,
        controller.signal
      )
    } finally {
      active.controller.signal.removeEventListener('abort', abort)
      signal?.removeEventListener('abort', abort)
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
        // 연결이 이미 정리됐으면 **던진다.** 해소된 값으로 돌려주면 플러그인이 그것을 그대로
        // 도구 결과로 반환할 수 있고, 그러면 MCP 경계에서 `isError` 없는 빈 성공이 되어
        // 모델이 '취소' 를 '성공, 결과 없음' 으로 읽는다(0158 verify r1 D5 실측). 예외는 SDK 가
        // `isError:true` 로 변환하므로 플러그인 구현과 무관하게 실패가 실패로 보인다.
        if (active.controller.signal.aborted) {
          return Promise.reject(new Error(`connector connection is closed: ${active.connectorId}`))
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
      // remove 실패가 정리를 중단시키면 안 된다. 중단되면 ⓐ runtime server 가 registry 에 남아
      // LLM 에 계속 노출되고 ⓑ activeByConnector 에서 지워지지 않아 재연결도 거부되며
      // ⓒ cleanup 이 rejected promise 로 캐시돼 재시도가 영구 불가해진다(0158 verify r1 D7 실측).
      // stopByBinding 은 이미 감싸져 있었는데 remove 만 무방비였던 비대칭을 없앤다.
      for (const serverId of active.serverIds) {
        try {
          this.deps.runtimeTools.remove(serverId)
        } catch (error) {
          this.deps.logger?.('plugin-host.runtime-tool.remove.failed', {
            connectorId: active.connectorId,
            serverId,
            message: String(error)
          })
        }
      }
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

// 필드를 **열거하지 않고** 비교한다. 손으로 나열하면 `BindingFingerprint` 에 식별 필드를
// 하나 더한 순간 이 함수만 그대로 남아, 서로 다른 binding 이 같다고 판정된다 — 그게 곧
// 시작 도중 binding 이 바뀐 것을 놓치는 경로다. 값은 전부 문자열이라 얕은 비교로 충분하다.
function sameFingerprint(left: BindingFingerprint, right: BindingFingerprint): boolean {
  const keys = Object.keys(left) as (keyof BindingFingerprint)[]
  if (keys.length !== Object.keys(right).length) return false
  return keys.every((key) => left[key] === right[key])
}
