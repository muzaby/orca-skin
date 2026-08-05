// PluginHost → `UsageSourcePort` 어댑터 (0176).
//
// **컴포지션 루트에 두는 이유**: `features/usage` 는 `features/auth-platform` 을 import 할 수
// 없다(수직 슬라이스 교차 금지). 두 슬라이스를 동시에 알아도 되는 레이어는 여기뿐이다.
//
// PluginHost 구체 타입 대신 **구조적 포트**를 받는다 — electron·binding 없이 스텁으로 테스트할
// 수 있어야 이 배선이 회귀 대상이 된다.

import type { ConnectorRequest, ConnectorResult } from '../contracts/connector-plugin'
import type {
  UsageSample,
  UsageSampleOutcome,
  UsageSampleRequest,
  UsageSourceInfo,
  UsageSourcePort
} from '../contracts/usage-source'
import type { UsagePayloadEnvelope } from '../features/auth-platform/modules/usage'

export interface UsageConnectorLookup {
  list(): ReadonlyArray<{ connectorId: string; label: string; connected: boolean }>
  invokeConnector(
    connectorId: string,
    request: ConnectorRequest,
    signal?: AbortSignal
  ): Promise<ConnectorResult>
}

export function createUsageSourcePort(
  host: UsageConnectorLookup,
  clock: () => number = Date.now
): UsageSourcePort {
  return {
    list(): readonly UsageSourceInfo[] {
      return host.list().map((info) => ({
        sourceId: info.connectorId,
        label: info.label,
        connected: info.connected
      }))
    },

    async invoke(
      sourceId: string,
      request: UsageSampleRequest,
      signal?: AbortSignal
    ): Promise<UsageSampleOutcome> {
      const known = host.list().find((info) => info.connectorId === sourceId)
      if (!known) {
        return { ok: false, sourceId, operation: request.operation, reason: 'unknown_source' }
      }
      if (!known.connected) {
        return { ok: false, sourceId, operation: request.operation, reason: 'not_connected' }
      }

      let result: ConnectorResult
      try {
        result = await host.invokeConnector(
          sourceId,
          {
            operation: request.operation,
            ...(request.params !== undefined ? { params: request.params } : {})
          },
          signal
        )
      } catch (error) {
        // 예외를 그대로 올리지 않는다 — 사용량 갱신 사이클은 source 하나의 실패로 멈추면 안 된다.
        return {
          ok: false,
          sourceId,
          operation: request.operation,
          reason: 'invoke_failed',
          message: String(error)
        }
      }

      if (!result.ok) {
        return {
          ok: false,
          sourceId,
          operation: request.operation,
          reason: 'invoke_failed',
          message: result.message
        }
      }

      const envelope = asEnvelope(result.data)
      if (!envelope) {
        return { ok: false, sourceId, operation: request.operation, reason: 'bad_shape' }
      }
      const sample: UsageSample = {
        sourceId,
        operation: request.operation,
        fetchedAt: clock(),
        status: envelope.status,
        ...(envelope.contentType !== undefined ? { contentType: envelope.contentType } : {}),
        payload: envelope.payload
      }
      return { ok: true, sample }
    }
  }
}

// connector 는 `{status, contentType?, payload}` 를 준다는 것이 유일한 계약이다. 어긋나면
// 표본을 만들지 않는다 — 형상 없는 값을 payload 로 흘리면 map 이 조용히 오해한다.
function asEnvelope(data: unknown): UsagePayloadEnvelope | null {
  if (data === null || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (typeof record.status !== 'number') return null
  if (!('payload' in record)) return null
  const contentType = record.contentType
  return {
    status: record.status,
    ...(typeof contentType === 'string' ? { contentType } : {}),
    payload: record.payload
  }
}
