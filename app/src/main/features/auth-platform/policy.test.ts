import { describe, expect, it } from 'vitest'
import {
  checkBindingUsable,
  checkHeaders,
  checkOutboundRequest,
  checkRedirect,
  checkRequestPath,
  isOriginAllowed
} from './policy'
import type { BindingFacts } from './policy'

const ORIGIN = 'https://wiki.corp.invalid'
const CONNECTOR = 'corp-wiki'

const validBinding: BindingFacts = {
  id: 'bind_1',
  target: { kind: 'connector', connectorId: CONNECTOR, connectionId: 'c1' },
  status: 'valid'
}

describe('origin allowlist', () => {
  it('선언한 origin 만 허용한다', () => {
    expect(isOriginAllowed(`${ORIGIN}/rest/api`, [ORIGIN])).toBe(true)
    expect(isOriginAllowed('https://evil.invalid/x', [ORIGIN])).toBe(false)
  })

  it('서브도메인을 자동 허용하지 않는다', () => {
    expect(isOriginAllowed('https://sub.wiki.corp.invalid/x', [ORIGIN])).toBe(false)
  })

  it('포트·스킴이 다르면 다른 origin 이다', () => {
    expect(isOriginAllowed('http://wiki.corp.invalid/x', [ORIGIN])).toBe(false)
    expect(isOriginAllowed('https://wiki.corp.invalid:8443/x', [ORIGIN])).toBe(false)
  })

  it('파싱 불가 URL 은 거부한다', () => {
    expect(isOriginAllowed('not a url', [ORIGIN])).toBe(false)
  })
})

describe('요청 경로', () => {
  it('상대 경로를 허용한다', () => {
    expect(checkRequestPath('/rest/api/content').ok).toBe(true)
  })

  it('절대 URL 로 baseUrl 을 우회하려는 시도를 거부한다', () => {
    expect(checkRequestPath('https://evil.invalid/x').ok).toBe(false)
    expect(checkRequestPath('//evil.invalid/x').ok).toBe(false)
  })
})

describe('헤더 spoofing', () => {
  it('connector 가 Authorization 을 직접 덮어쓰면 거부한다', () => {
    const verdict = checkHeaders({ Authorization: 'Bearer stolen' })
    expect(verdict.ok).toBe(false)
  })

  it('대소문자를 우회로 쓸 수 없다', () => {
    expect(checkHeaders({ authorization: 'x' }).ok).toBe(false)
    expect(checkHeaders({ AUTHORIZATION: 'x' }).ok).toBe(false)
    expect(checkHeaders({ CoOkIe: 'x' }).ok).toBe(false)
  })

  it('예약되지 않은 헤더는 허용한다', () => {
    expect(checkHeaders({ Accept: 'application/json' }).ok).toBe(true)
  })
})

describe('binding 사용 가능성', () => {
  it('다른 connector 의 binding 을 빌려 쓸 수 없다', () => {
    expect(checkBindingUsable(validBinding, 'other-connector').ok).toBe(false)
  })

  it('application binding 을 connector 요청에 쓸 수 없다', () => {
    const appBinding: BindingFacts = {
      id: 'bind_app',
      target: { kind: 'application', applicationId: 'orca' },
      status: 'valid'
    }
    expect(checkBindingUsable(appBinding, CONNECTOR).ok).toBe(false)
  })

  it('valid 가 아닌 binding 을 거부한다', () => {
    for (const status of ['expired', 'revoked', 'unknown'] as const) {
      expect(checkBindingUsable({ ...validBinding, status }, CONNECTOR).ok).toBe(false)
    }
  })
})

describe('checkOutboundRequest 통합', () => {
  const base = {
    url: `${ORIGIN}/rest/api/content`,
    path: '/rest/api/content',
    connectorId: CONNECTOR,
    binding: validBinding,
    allowedOrigins: [ORIGIN]
  }

  it('정상 요청을 통과시킨다', () => {
    expect(checkOutboundRequest(base).ok).toBe(true)
  })

  it('허용되지 않은 origin 을 거부하고 사유에 전체 URL 을 싣지 않는다', () => {
    const verdict = checkOutboundRequest({
      ...base,
      url: 'https://evil.invalid/steal?token=abc'
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.reason).toBe('origin_not_allowed')
      // 쿼리에 토큰이 실릴 수 있으므로 origin 까지만 남긴다.
      expect(verdict.detail).not.toMatch(/token=abc/)
    }
  })

  it('예약 헤더가 origin 검사보다 먼저 걸린다', () => {
    const verdict = checkOutboundRequest({ ...base, headers: { Cookie: 'a=b' } })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toBe('reserved_header')
  })
})

describe('redirect 재검사', () => {
  it('allowlist 밖으로의 redirect 를 거부한다', () => {
    expect(checkRedirect('https://evil.invalid/', [ORIGIN]).ok).toBe(false)
    expect(checkRedirect(`${ORIGIN}/next`, [ORIGIN]).ok).toBe(true)
  })
})
