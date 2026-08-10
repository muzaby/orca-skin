import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../../../../shared/ipc'
import { selectGatePrincipal } from './principal'

function info(over: Partial<ProviderInfo> & Pick<ProviderInfo, 'id'>): ProviderInfo {
  return {
    label: over.id,
    kind: 'gate',
    origin: 'https://portal.example.corp',
    auth: [],
    status: 'valid',
    activeAuthKind: 'browser-session',
    principal: null,
    expiresAt: null,
    ...over
  }
}

describe('selectGatePrincipal', () => {
  it('게이트 0개면 null 이다', () => {
    expect(selectGatePrincipal([])).toBeNull()
    expect(
      selectGatePrincipal([info({ id: 'wiki', kind: 'service', principal: 'pat-user' })])
    ).toBeNull()
  })

  it('게이트 1개의 principal 을 그대로 쓴다', () => {
    expect(selectGatePrincipal([info({ id: 'corp-sso', principal: 'a@example.corp' })])).toBe(
      'a@example.corp'
    )
  })

  it('게이트 N개면 선언 순서상 principal 이 있는 첫 게이트를 고른다', () => {
    const principal = selectGatePrincipal([
      info({ id: 'first', principal: null }),
      info({ id: 'second', principal: 'b@example.corp' }),
      info({ id: 'third', principal: 'c@example.corp' })
    ])
    expect(principal).toBe('b@example.corp')
  })

  it('게이트가 있어도 아무도 principal 이 없으면 null 이다 (폴백 라벨이 뜬다)', () => {
    expect(
      selectGatePrincipal([info({ id: 'corp-sso', principal: null, activeAuthKind: 'pat' })])
    ).toBeNull()
  })

  it('빈 문자열 principal 은 신원으로 치지 않는다', () => {
    expect(selectGatePrincipal([info({ id: 'corp-sso', principal: '' })])).toBeNull()
  })

  it('만료된 게이트의 principal 도 계속 보여 준다 — 누가 재인증할지 알려야 한다', () => {
    expect(
      selectGatePrincipal([
        info({ id: 'corp-sso', status: 'expired', principal: 'a@example.corp' })
      ])
    ).toBe('a@example.corp')
  })

  it('서비스 provider 의 principal 은 무시한다 — 앱 신원은 게이트가 정한다', () => {
    const principal = selectGatePrincipal([
      info({ id: 'wiki', kind: 'service', principal: 'pat-user' }),
      info({ id: 'corp-sso', principal: 'a@example.corp' })
    ])
    expect(principal).toBe('a@example.corp')
  })
})
