import { describe, expect, it, vi } from 'vitest'
import { createUsageSourcePort, type UsageConnectorLookup } from './usage-source'
import type { ConnectorRequest, ConnectorResult } from '../contracts/connector-plugin'

function lookup(
  overrides: Partial<UsageConnectorLookup> = {},
  connectors = [{ connectorId: 'usage-corp', label: '사내 사용량', connected: true }]
): UsageConnectorLookup {
  return {
    list: () => connectors,
    invokeConnector: async () => ({ ok: true, data: { status: 200, payload: {} } }),
    ...overrides
  }
}

describe('createUsageSourcePort', () => {
  it('connector 목록을 source 목록으로 옮긴다', () => {
    const port = createUsageSourcePort(
      lookup({}, [
        { connectorId: 'usage-corp', label: '사내', connected: true },
        { connectorId: 'usage-lab', label: '연구소', connected: false }
      ])
    )

    expect(port.list()).toEqual([
      { sourceId: 'usage-corp', label: '사내', connected: true },
      { sourceId: 'usage-lab', label: '연구소', connected: false }
    ])
  })

  it('connector 결과를 UsageSample 로 정규화한다', async () => {
    const calls: ConnectorRequest[] = []
    const port = createUsageSourcePort(
      lookup({
        invokeConnector: async (_id, request) => {
          calls.push(request)
          return {
            ok: true,
            data: {
              status: 200,
              contentType: 'application/json',
              payload: { quota: { usedUsd: 3 } }
            }
          }
        }
      }),
      () => 1234
    )

    const outcome = await port.invoke('usage-corp', {
      operation: 'quota',
      params: { scope: 'month' }
    })

    expect(calls).toEqual([{ operation: 'quota', params: { scope: 'month' } }])
    expect(outcome).toEqual({
      ok: true,
      sample: {
        sourceId: 'usage-corp',
        operation: 'quota',
        fetchedAt: 1234,
        status: 200,
        contentType: 'application/json',
        payload: { quota: { usedUsd: 3 } }
      }
    })
  })

  it('모르는 source 와 미연결 source 를 구분해 강등한다', async () => {
    const invokeConnector = vi.fn()
    const port = createUsageSourcePort(
      lookup({ invokeConnector: invokeConnector as UsageConnectorLookup['invokeConnector'] }, [
        { connectorId: 'usage-corp', label: '사내', connected: false }
      ])
    )

    await expect(port.invoke('usage-zzz', { operation: 'quota' })).resolves.toMatchObject({
      ok: false,
      reason: 'unknown_source'
    })
    await expect(port.invoke('usage-corp', { operation: 'quota' })).resolves.toMatchObject({
      ok: false,
      reason: 'not_connected'
    })
    expect(invokeConnector).not.toHaveBeenCalled()
  })

  it('실패·형상 불일치를 ok:false 로 강등한다', async () => {
    const results: ConnectorResult[] = [
      { ok: false, message: 'HTTP 500' },
      { ok: true, data: null },
      { ok: true, data: { payload: {} } },
      { ok: true, data: { status: 200 } }
    ]
    const port = createUsageSourcePort(
      lookup({ invokeConnector: async () => results.shift() as ConnectorResult })
    )

    await expect(port.invoke('usage-corp', { operation: 'quota' })).resolves.toMatchObject({
      ok: false,
      reason: 'invoke_failed',
      message: 'HTTP 500'
    })
    // data 가 null · status 없음 · payload 없음 — 세 형상 모두 표본을 만들지 않는다.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(port.invoke('usage-corp', { operation: 'quota' })).resolves.toMatchObject({
        ok: false,
        reason: 'bad_shape'
      })
    }
  })

  it('호출이 던져도 예외를 올리지 않는다', async () => {
    const port = createUsageSourcePort(
      lookup({
        invokeConnector: async () => {
          throw new Error('connector exploded')
        }
      })
    )

    await expect(port.invoke('usage-corp', { operation: 'quota' })).resolves.toMatchObject({
      ok: false,
      reason: 'invoke_failed',
      message: expect.stringContaining('connector exploded')
    })
  })
})
