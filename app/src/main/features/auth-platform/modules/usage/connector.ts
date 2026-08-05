// 범용 usage connector 런타임 (0176).
//
// **raw credential 을 보지 않는다** — `ctx.authenticatedFetch` 만 부르고 주입은 broker 가 한다
// (AUTH-PLAT-009). 이 디렉터리에 vault·secret·전역 fetch import 가 하나도 없는 것이 확인 가능한
// 속성이다.
//
// 이 connector 는 **응답을 해석하지 않는다.** `{status, contentType, payload}` 를 그대로
// 돌려주고, quota·사용액으로 읽는 일은 usage provider 의 `map` 이 한다 — LLM provider 마다
// 반환 포맷이 다르기 때문이다(0176 요구).

import type {
  ConnectorContext,
  ConnectorDescriptor,
  ConnectorRequest,
  ConnectorResult,
  ConnectorRuntimeV1,
  ConnectorStatus
} from '../../../../contracts/connector-plugin'
import { buildUsageRequest } from './request'
import { toUsagePayload, type UsagePayloadEnvelope } from './payload'
import { DEFAULT_USAGE_PRESENTATION, type UsageConnectorConfig } from './spec'

export const USAGE_PLUGIN_ID = 'usage-connector'
export const USAGE_PAT_PROVIDER_ID = 'usage-connector-pat'
export const USAGE_BASIC_PROVIDER_ID = 'usage-connector-basic'

export function usageConnectorDescriptor(config: UsageConnectorConfig): ConnectorDescriptor {
  return {
    id: config.id,
    pluginId: USAGE_PLUGIN_ID,
    apiVersion: 1,
    label: config.label,
    acceptedAuthProviders: [
      ...(config.acceptedAuthProviders ?? [USAGE_PAT_PROVIDER_ID, USAGE_BASIC_PROVIDER_ID])
    ],
    baseUrl: config.baseUrl,
    presentation: config.presentation ?? DEFAULT_USAGE_PRESENTATION,
    ...(config.presentations !== undefined ? { presentations: config.presentations } : {})
  }
}

export function createUsageConnector(config: UsageConnectorConfig): ConnectorRuntimeV1 {
  const descriptor = usageConnectorDescriptor(config)

  const send = async (
    ctx: ConnectorContext,
    operation: string,
    params: Record<string, unknown>
  ): Promise<UsagePayloadEnvelope | null> => {
    const request = buildUsageRequest(config, config.id, ctx.bindingId, operation, params)
    if (!request) return null
    const response = await ctx.authenticatedFetch(request, ctx.signal)
    return toUsagePayload(response)
  }

  return {
    descriptor,

    async start(ctx: ConnectorContext): Promise<ConnectorStatus> {
      const probe = config.probe
      // probe 미선언 = 확인용 endpoint 가 없는 배포. 요청을 0건 보내고 연결을 연다 —
      // 실제 유효성은 첫 사용량 호출이 알려 준다.
      if (!probe) return { health: 'ready' }
      try {
        const result = await send(ctx, probe.operation, probe.params ?? {})
        if (!result) {
          return {
            health: 'error',
            message: `probe operation 이 선언되지 않았습니다: ${probe.operation}`
          }
        }
        return healthFromStatus(result.status, config.label)
      } catch (error) {
        ctx.logger('usage.connector.start.failed', {
          connectorId: config.id,
          message: String(error)
        })
        return { health: 'unreachable', message: `${config.label} 서버에 연결하지 못했습니다` }
      }
    },

    async invoke(ctx: ConnectorContext, request: ConnectorRequest): Promise<ConnectorResult> {
      try {
        const result = await send(ctx, request.operation, request.params ?? {})
        // 선언 밖 operation 은 거부한다 — 허용 목록 강제 지점이 여기다.
        if (!result) {
          return { ok: false, message: `지원하지 않는 operation 입니다: ${request.operation}` }
        }
        // 4xx·5xx 도 표본으로 올리지 않는다. 오류 본문을 quota 로 읽는 map 이 나오면
        // 잘못된 값이 권위값으로 영속된다.
        if (result.status >= 400) {
          const health = healthFromStatus(result.status, config.label)
          return {
            ok: false,
            message: `사용량 조회가 실패했습니다 (HTTP ${result.status})`,
            ...(health.health !== 'ready' ? { health: health.health } : {})
          }
        }
        return { ok: true, data: result }
      } catch (error) {
        ctx.logger('usage.connector.invoke.failed', {
          connectorId: config.id,
          operation: request.operation,
          message: String(error)
        })
        return { ok: false, message: '사용량 조회 요청이 실패했습니다', health: 'unreachable' }
      }
    },

    async stop(): Promise<void> {
      // 상주 자원이 없다 — 호출 단위로 끝난다.
    }
  }
}

// `ConnectorHealth` 4멤버 전수 매핑.
function healthFromStatus(status: number, label: string): ConnectorStatus {
  if (status >= 200 && status < 300) return { health: 'ready' }
  if (status === 401 || status === 403) {
    return { health: 'unauthenticated', message: '자격증명이 거부되었습니다' }
  }
  if (status >= 500)
    return { health: 'unreachable', message: `${label} 서버가 응답하지 못했습니다` }
  return { health: 'error', message: `예상치 못한 응답입니다 (HTTP ${status})` }
}
