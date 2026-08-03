// Connector 런타임 (0157) — 연결된 connector 를 시작·호출·정지한다.
//
// 이 슬라이스는 **raw credential 을 절대 보지 않는다.** connector 에게 주는 것은
// `authenticatedFetch(bindingId, …)` 뿐이고, header·cookie 주입은 broker 가 한다
// (AUTH-PLAT-009). 그래서 여기서 vault·session·secret 을 import 하는 코드가 하나도 없다 —
// 그것이 이 파일에서 확인할 수 있는 보안 속성이다.
//
// 레이어: features/auth-platform 을 직접 import 하지 않는다. `AuthenticatedFetch` 는
// `contracts/connector-plugin.ts` 의 구조적 포트이고 컴포지션 루트가 broker 구현을 주입한다.

import type {
  AuthenticatedFetch,
  ConnectorRequest,
  ConnectorResult,
  ConnectorRuntimeV1,
  ConnectorStatus
} from '../../contracts/connector-plugin'
import { getLogger } from '../../infra/log/registry'
import type { Connection, ConnectionRegistry, CreateConnectionInput } from './registry'

export interface ConnectorHostDeps {
  connections: ConnectionRegistry
  // connector 구현체 조회 — auth-platform registry 를 구조적 포트로 받는다(교차 import 회피).
  lookup: { getConnector(connectorId: string): ConnectorRuntimeV1 | undefined }
  authenticatedFetch: AuthenticatedFetch
}

const DEFAULT_INVOKE_TIMEOUT_MS = 60_000

export class ConnectorHost {
  private readonly started = new Map<string, Connection>()

  constructor(private readonly deps: ConnectorHostDeps) {}

  private log(): ReturnType<ReturnType<typeof getLogger>['child']> {
    return getLogger().child('connectors')
  }

  private resolve(
    connectionId: string
  ): { connection: Connection; connector: ConnectorRuntimeV1 } | null {
    const connection = this.deps.connections.get(connectionId)
    if (!connection) return null
    const connector = this.deps.lookup.getConnector(connection.connectorId)
    if (!connector) return null
    return { connection, connector }
  }

  private contextFor(
    connection: Connection,
    signal: AbortSignal
  ): Parameters<ConnectorRuntimeV1['start']>[0] {
    return {
      connectionId: connection.id,
      bindingId: connection.bindingId,
      authenticatedFetch: this.deps.authenticatedFetch,
      signal,
      logger: (message, meta) =>
        this.log().warn('connector.message', {
          connectorId: connection.connectorId,
          message,
          ...(meta !== undefined ? { meta } : {})
        })
    }
  }

  private markStarted(connection: Connection): void {
    if (this.deps.connections.get(connection.id) === connection) {
      this.started.set(connection.id, connection)
    }
  }

  private clearStarted(connection: Connection): void {
    if (this.started.get(connection.id) === connection) {
      this.started.delete(connection.id)
    }
  }

  async connect(input: CreateConnectionInput, signal?: AbortSignal): Promise<ConnectorStatus> {
    if (signal?.aborted) return cancelledStatus()
    const connection = this.deps.connections.create(input)
    const status = await this.start(connection.id, signal)
    if (status.health !== 'ready') {
      this.deps.connections.removeIfSame(connection.id, connection)
      this.clearStarted(connection)
    }
    return status
  }

  async start(connectionId: string, signal?: AbortSignal): Promise<ConnectorStatus> {
    if (signal?.aborted) return cancelledStatus()
    const resolved = this.resolve(connectionId)
    if (!resolved) return { health: 'error', message: '알 수 없는 연결입니다' }
    const controller = new AbortController()
    try {
      const status = await resolved.connector.start(
        this.contextFor(resolved.connection, signal ?? controller.signal)
      )
      if (status.health === 'ready') this.markStarted(resolved.connection)
      return status
    } catch (err) {
      // connector 예외를 표준 상태로 정규화한다 — 원문 메시지는 로그로만.
      this.log().warn('connector.start.failed', {
        connectorId: resolved.connection.connectorId,
        message: String(err)
      })
      return { health: 'error', message: 'connector 시작에 실패했습니다' }
    }
  }

  async invoke(
    connectionId: string,
    request: ConnectorRequest,
    timeoutMs = DEFAULT_INVOKE_TIMEOUT_MS,
    signal?: AbortSignal
  ): Promise<ConnectorResult> {
    if (signal?.aborted) return cancelledResult()
    const resolved = this.resolve(connectionId)
    if (!resolved) return { ok: false, message: '알 수 없는 연결입니다' }

    const controller = new AbortController()
    const combined = composeAbortSignals([controller.signal, signal])
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await resolved.connector.invoke(
        this.contextFor(resolved.connection, combined.signal),
        request
      )
    } catch (err) {
      this.log().warn('connector.invoke.failed', {
        connectorId: resolved.connection.connectorId,
        operation: request.operation,
        message: String(err)
      })
      return { ok: false, message: 'connector 호출에 실패했습니다', health: 'error' }
    } finally {
      clearTimeout(timer)
      combined.dispose()
    }
  }

  async stop(connectionId: string): Promise<void> {
    const resolved = this.resolve(connectionId)
    if (!resolved) return
    const controller = new AbortController()
    try {
      await resolved.connector.stop(this.contextFor(resolved.connection, controller.signal))
    } catch (err) {
      this.log().warn('connector.stop.failed', {
        connectorId: resolved.connection.connectorId,
        message: String(err)
      })
    } finally {
      this.clearStarted(resolved.connection)
    }
  }

  // binding 이 끊기면 그 binding 을 쓰던 연결을 정리한다. broker logout 후 컴포지션 루트가 부른다.
  async stopByBinding(bindingId: string): Promise<void> {
    const victims = this.deps.connections.list().filter((c) => c.bindingId === bindingId)
    await Promise.all(victims.map((c) => this.stop(c.id)))
    for (const connection of victims) {
      this.deps.connections.removeIfSame(connection.id, connection)
    }
  }

  isStarted(connectionId: string): boolean {
    const connection = this.deps.connections.get(connectionId)
    return connection !== undefined && this.started.get(connectionId) === connection
  }
}

function cancelledStatus(): ConnectorStatus {
  return { health: 'error', message: 'connector start was cancelled' }
}

function cancelledResult(): ConnectorResult {
  return { ok: false, message: 'connector invocation was cancelled', health: 'error' }
}

function composeAbortSignals(signals: readonly (AbortSignal | undefined)[]): {
  signal: AbortSignal
  dispose: () => void
} {
  const controller = new AbortController()
  const listeners: Array<{ signal: AbortSignal; listener: () => void }> = []
  const abort = (source: AbortSignal): void => {
    if (!controller.signal.aborted) controller.abort(source.reason)
  }

  for (const source of signals) {
    if (!source) continue
    if (source.aborted) {
      abort(source)
      break
    }
    const listener = (): void => abort(source)
    source.addEventListener('abort', listener, { once: true })
    listeners.push({ signal: source, listener })
  }

  return {
    signal: controller.signal,
    dispose: () => {
      for (const { signal: source, listener } of listeners) {
        source.removeEventListener('abort', listener)
      }
    }
  }
}
