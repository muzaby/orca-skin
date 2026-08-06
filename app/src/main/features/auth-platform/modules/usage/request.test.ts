import { describe, expect, it } from 'vitest'
import { buildUsageRequest, substitute } from './request'
import type { UsageConnectorConfig } from './spec'

const config: UsageConnectorConfig = {
  id: 'usage-corp',
  label: '사내 사용량',
  baseUrl: 'https://llm.corp',
  apiBasePath: '/portal/',
  operations: {
    quota: { method: 'GET', path: 'v1/quota', query: { scope: '{scope}', fixed: 'month' } },
    team: { method: 'GET', path: '/v1/teams/{team}/quota' },
    submit: { method: 'POST', path: '/v1/report', body: '{"team":"{team}"}' }
  }
}

describe('buildUsageRequest', () => {
  it('선언된 자리표시자만 인코딩해 치환한다', () => {
    const request = buildUsageRequest(config, 'usage-corp', 'team', {
      team: '../secrets?x=1',
      // 선언되지 않은 파라미터는 요청에 새지 않는다.
      unexpected: 'ignored'
    })

    expect(request).toMatchObject({
      method: 'GET',
      path: '/portal/v1/teams/..%2Fsecrets%3Fx%3D1/quota'
    })
    expect(JSON.stringify(request)).not.toContain('ignored')
  })

  it('apiBasePath 를 정규화해 경로 앞에 붙이고 query 를 치환한다', () => {
    const request = buildUsageRequest(config, 'usage-corp', 'quota', { scope: 'week' })

    expect(request).toEqual({
      target: 'usage-corp',
      method: 'GET',
      path: '/portal/v1/quota',
      query: { scope: 'week', fixed: 'month' }
    })
  })

  it('값이 없는 자리표시자는 원문으로 남긴다', () => {
    const request = buildUsageRequest(config, 'usage-corp', 'team', {})

    expect(request?.path).toBe('/portal/v1/teams/{team}/quota')
  })

  it('body 에도 치환을 적용한다', () => {
    const request = buildUsageRequest(config, 'usage-corp', 'submit', {
      team: 'alpha'
    })

    expect(request).toMatchObject({ method: 'POST', body: '{"team":"alpha"}' })
  })

  it('선언되지 않은 operation 은 null 이다', () => {
    expect(buildUsageRequest(config, 'usage-corp', 'unknown')).toBeNull()
  })
})

describe('substitute', () => {
  it('숫자·불리언도 문자열로 치환한다', () => {
    expect(substitute('/v1/{n}/{flag}', { n: 12, flag: true })).toBe('/v1/12/true')
  })
})
