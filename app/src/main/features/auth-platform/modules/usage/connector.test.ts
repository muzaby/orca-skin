import { describe, expect, it, vi } from 'vitest'
import { createUsageConnector } from './connector'
import { BASIC_METHOD_ID, PAT_METHOD_ID } from '../../methods/credential'
import type { UsageConnectorConfig } from './spec'
import type { ConnectorContext } from '../../../../contracts/connector'
import type { InternalApiRequest, InternalApiResponse } from '../../../../contracts/internal-api'

function config(overrides: Partial<UsageConnectorConfig> = {}): UsageConnectorConfig {
  return {
    id: 'usage-corp',
    label: '사내 사용량',
    baseUrl: 'https://llm.corp',
    operations: {
      quota: { method: 'GET', path: '/v1/quota', query: { scope: 'month' } }
    },
    ...overrides
  }
}

function context(
  request: (req: InternalApiRequest) => Promise<InternalApiResponse>
): ConnectorContext {
  return {
    connectionId: 'conn-1',
    request: (req) => request(req),
    signal: new AbortController().signal,
    logger: () => undefined
  }
}

function response(
  status: number,
  body = '{}',
  headers: Record<string, string> = { 'content-type': 'application/json' }
): InternalApiResponse {
  return { status, headers, body }
}

describe('createUsageConnector', () => {
  it('선언한 operation 을 요청으로 만들고 JSON 을 payload 로 돌려준다', async () => {
    const seen: InternalApiRequest[] = []
    const connector = createUsageConnector(config({ apiBasePath: '/portal' }))

    const result = await connector.invoke(
      context(async (req) => {
        seen.push(req)
        return response(200, '{"quota":{"usedUsd":42}}')
      }),
      { operation: 'quota' }
    )

    expect(seen).toEqual([
      {
        target: 'usage-corp',
        method: 'GET',
        path: '/portal/v1/quota',
        query: { scope: 'month' }
      }
    ])
    expect(result).toEqual({
      ok: true,
      data: {
        status: 200,
        contentType: 'application/json',
        payload: { quota: { usedUsd: 42 } }
      }
    })
  })

  it('미선언 operation 은 거부한다', async () => {
    const authenticatedFetch = vi.fn(async () => response(200))
    const connector = createUsageConnector(config())

    const result = await connector.invoke(context(authenticatedFetch), { operation: 'nope' })

    expect(result).toMatchObject({ ok: false })
    expect(authenticatedFetch).not.toHaveBeenCalled()
  })

  it('4xx·5xx 응답은 표본이 아니라 실패로 돌려준다', async () => {
    const connector = createUsageConnector(config())

    const denied = await connector.invoke(
      context(async () => response(403, 'nope', {})),
      {
        operation: 'quota'
      }
    )
    const broken = await connector.invoke(
      context(async () => response(503, 'busy', {})),
      {
        operation: 'quota'
      }
    )

    expect(denied).toMatchObject({ ok: false, health: 'unauthenticated' })
    expect(broken).toMatchObject({ ok: false, health: 'unreachable' })
  })

  it('전송 예외는 unreachable 실패로 정규화한다', async () => {
    const connector = createUsageConnector(config())

    const result = await connector.invoke(
      context(async () => {
        throw new Error('socket closed')
      }),
      { operation: 'quota' }
    )

    expect(result).toMatchObject({ ok: false, health: 'unreachable' })
  })

  it('probe 상태코드를 health 4종으로 매핑한다', async () => {
    const connector = createUsageConnector(config({ probe: { operation: 'quota' } }))
    const health = async (status: number): Promise<string> =>
      (await connector.start(context(async () => response(status, '{}', {})))).health

    expect(await health(200)).toBe('ready')
    expect(await health(401)).toBe('unauthenticated')
    expect(await health(403)).toBe('unauthenticated')
    expect(await health(500)).toBe('unreachable')
    expect(await health(418)).toBe('error')
  })

  it('probe 요청이 던지면 unreachable 이다', async () => {
    const connector = createUsageConnector(config({ probe: { operation: 'quota' } }))

    const status = await connector.start(
      context(async () => {
        throw new Error('offline')
      })
    )

    expect(status).toMatchObject({ health: 'unreachable' })
  })

  it('probe 미선언이면 요청 없이 ready', async () => {
    const authenticatedFetch = vi.fn(async () => response(200))
    const connector = createUsageConnector(config())

    const status = await connector.start(context(authenticatedFetch))

    expect(status).toEqual({ health: 'ready' })
    expect(authenticatedFetch).not.toHaveBeenCalled()
  })

  it('선언되지 않은 probe operation 은 error 로 알린다', async () => {
    const connector = createUsageConnector(config({ probe: { operation: 'missing' } }))

    const status = await connector.start(context(async () => response(200)))

    expect(status.health).toBe('error')
  })

  it('descriptor 기본값은 이 패키지의 provider 2종과 Bearer 표현이다', () => {
    const { descriptor } = createUsageConnector(config())

    expect(descriptor.acceptedMethods).toEqual([PAT_METHOD_ID, BASIC_METHOD_ID])
    expect(descriptor.presentation).toEqual({
      location: 'header',
      name: 'Authorization',
      scheme: 'Bearer'
    })
  })

  it('설정이 선언한 provider·표현을 그대로 쓴다', () => {
    const { descriptor } = createUsageConnector(
      config({
        acceptedMethods: ['corp-adfs'],
        presentation: { location: 'header', name: 'X-Api-Key', scheme: 'Raw' }
      })
    )

    expect(descriptor.acceptedMethods).toEqual(['corp-adfs'])
    expect(descriptor.presentation).toMatchObject({ name: 'X-Api-Key' })
  })
})
