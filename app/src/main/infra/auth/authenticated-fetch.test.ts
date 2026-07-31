// AC8 의 핵심 검증 (0157 verify r1 / D3) — **credential kind 에서 presentation 을 추론하지 않는다.**
//
// 요구명세 §Static credential 와 HTTP presentation 의 요지: 같은 PAT 를 서비스별로 Bearer /
// Basic password / 전용 header 로 다르게 붙일 수 있어야 한다. 그 "다르게" 를 한 곳에서 대조한다.

import { describe, expect, it } from 'vitest'
import { applyPresentation, type PreparedRequest } from './authenticated-fetch'
import type { CredentialPresentation } from '../../../shared/ipc'

const PAT = 'glpat-EXAMPLE-TOKEN'

function req(): PreparedRequest {
  return { url: 'https://wiki.corp.invalid/rest/api/content', method: 'GET', headers: {} }
}

describe('applyPresentation — 같은 credential, 다른 표현 (AC8)', () => {
  // 이 표가 AC8 그 자체다: **하나의 PAT** 가 선언에 따라 4가지로 나간다.
  const cases: Array<{ label: string; presentation: CredentialPresentation; expect: string }> = [
    {
      label: 'Bearer (GitHub·일반 REST)',
      presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
      expect: `Bearer ${PAT}`
    },
    {
      label: 'Basic password (일부 Atlassian 배포)',
      presentation: { location: 'header', name: 'Authorization', scheme: 'Basic' },
      expect: `Basic ${Buffer.from(`:${PAT}`).toString('base64')}`
    },
    {
      label: 'Token (일부 사내 게이트웨이)',
      presentation: { location: 'header', name: 'Authorization', scheme: 'Token' },
      expect: `Token ${PAT}`
    },
    {
      label: '전용 header (GitLab PRIVATE-TOKEN)',
      presentation: { location: 'header', name: 'PRIVATE-TOKEN' },
      expect: PAT
    }
  ]

  for (const c of cases) {
    it(`${c.label} 로 붙인다`, () => {
      const out = applyPresentation(req(), c.presentation, PAT)
      expect(out.headers[c.presentation.name as string]).toBe(c.expect)
    })
  }

  it('네 가지 표현이 서로 다르다 — kind 하나에 표현이 고정되지 않는다', () => {
    const rendered = cases.map((c) => {
      const out = applyPresentation(req(), c.presentation, PAT)
      return `${c.presentation.name}: ${out.headers[c.presentation.name as string]}`
    })
    expect(new Set(rendered).size).toBe(4)
  })

  it('scheme 미지정(Raw)은 값을 그대로 넣는다', () => {
    const out = applyPresentation(req(), { location: 'header', name: 'X-API-Key' }, 'key123')
    expect(out.headers['X-API-Key']).toBe('key123')
  })

  it("scheme 'Raw' 를 명시해도 동일하다", () => {
    const out = applyPresentation(
      req(),
      { location: 'header', name: 'X-API-Key', scheme: 'Raw' },
      'key123'
    )
    expect(out.headers['X-API-Key']).toBe('key123')
  })
})

describe('applyPresentation — cookie / query', () => {
  it('cookie 는 기존 Cookie 헤더를 덮어쓰지 않고 덧붙인다', () => {
    const base: PreparedRequest = { ...req(), headers: { Cookie: 'existing=1' } }
    const out = applyPresentation(base, { location: 'cookie', name: 'session' }, PAT)
    expect(out.headers.Cookie).toBe(`existing=1; session=${PAT}`)
  })

  it('기존 Cookie 가 없으면 새로 만든다', () => {
    const out = applyPresentation(req(), { location: 'cookie', name: 'session' }, PAT)
    expect(out.headers.Cookie).toBe(`session=${PAT}`)
  })

  it('query 는 URL 에 실리고 헤더는 건드리지 않는다', () => {
    const out = applyPresentation(
      req(),
      { location: 'query', name: 'access_token', restricted: true },
      PAT
    )
    expect(new URL(out.url).searchParams.get('access_token')).toBe(PAT)
    expect(out.headers).toEqual({})
  })

  it('query 는 기존 쿼리 파라미터를 보존한다', () => {
    const base: PreparedRequest = { ...req(), url: 'https://wiki.corp.invalid/x?page=2' }
    const out = applyPresentation(
      base,
      { location: 'query', name: 'access_token', restricted: true },
      PAT
    )
    const params = new URL(out.url).searchParams
    expect(params.get('page')).toBe('2')
    expect(params.get('access_token')).toBe(PAT)
  })
})

describe('applyPresentation — 불변성', () => {
  it('입력 요청을 변형하지 않는다 (원본에 secret 이 남지 않는다)', () => {
    const base = req()
    applyPresentation(base, { location: 'header', name: 'Authorization', scheme: 'Bearer' }, PAT)
    expect(base.headers).toEqual({})
    expect(JSON.stringify(base)).not.toContain(PAT)
  })

  it('다른 헤더는 보존한다', () => {
    const base: PreparedRequest = { ...req(), headers: { Accept: 'application/json' } }
    const out = applyPresentation(
      base,
      { location: 'header', name: 'Authorization', scheme: 'Bearer' },
      PAT
    )
    expect(out.headers.Accept).toBe('application/json')
  })
})
