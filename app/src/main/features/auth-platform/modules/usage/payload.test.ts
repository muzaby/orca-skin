import { describe, expect, it } from 'vitest'
import { toUsagePayload } from './payload'

describe('toUsagePayload', () => {
  it('JSON 본문을 파싱해 payload 로 싣는다', () => {
    const envelope = toUsagePayload({
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: '{"quota":{"usedUsd":12}}'
    })

    expect(envelope).toEqual({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      payload: { quota: { usedUsd: 12 } }
    })
  })

  it('JSON 이 아니면 원문 문자열을 payload 로 싣는다', () => {
    const envelope = toUsagePayload({
      status: 200,
      headers: { 'content-type': 'text/csv' },
      body: 'team,used\nalpha,12\n'
    })

    expect(envelope.payload).toBe('team,used\nalpha,12\n')
  })

  it('content-type 이 JSON 이어도 본문이 깨졌으면 원문을 유지한다', () => {
    const envelope = toUsagePayload({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"quota":'
    })

    expect(envelope.payload).toBe('{"quota":')
  })

  it('본문이 비어 있으면 빈 문자열이고 content-type 이 없으면 키를 싣지 않는다', () => {
    const envelope = toUsagePayload({ status: 204, headers: {}, body: '' })

    expect(envelope).toEqual({ status: 204, payload: '' })
  })
})
