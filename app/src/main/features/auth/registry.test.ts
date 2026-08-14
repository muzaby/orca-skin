import { describe, expect, it } from 'vitest'
import type { AuthDefinition } from '../../contracts/auth'
import { isBareOrigin, AuthRegistry, registerAuthDefinitions } from './registry'

function provider(id: string, origin: string): AuthDefinition {
  return { id, label: id, origin, methods: [] }
}

describe('AuthRegistry (AC1)', () => {
  it('중복 id 와 비-origin 을 거부하고 나머지는 등록한다', () => {
    const { definitions, rejected } = registerAuthDefinitions([
      provider('wiki', 'https://wiki.example.corp'),
      // 중복 — 뒤에 온 선언이 조용히 덮어쓰지 않는다(vault 네임스페이스가 겹친다).
      provider('wiki', 'https://other.example.corp'),
      // 경로가 붙은 값은 origin 이 아니다.
      provider('jira', 'https://jira.example.corp/context'),
      provider('gw', 'https://gw.example.corp:8443')
    ])

    // 거부된 둘만 빠지고 나머지 둘은 그대로 등록된다 — 패키지 단위 all-or-nothing 이 아니다.
    expect(definitions.map((p) => p.id)).toEqual(['wiki', 'gw'])
    expect(definitions[0]?.origin).toBe('https://wiki.example.corp')
    expect(rejected).toEqual([
      { id: 'wiki', reason: 'duplicate_id', message: expect.any(String) },
      { id: 'jira', reason: 'invalid_origin', message: expect.any(String) }
    ])
  })

  it('origin 판정은 후행 슬래시·쿼리·해시를 전부 거부한다', () => {
    expect(isBareOrigin('https://wiki.example.corp')).toBe(true)
    expect(isBareOrigin('http://localhost:3000')).toBe(true)
    expect(isBareOrigin('https://wiki.example.corp/')).toBe(false)
    expect(isBareOrigin('https://wiki.example.corp?a=1')).toBe(false)
    expect(isBareOrigin('https://wiki.example.corp#x')).toBe(false)
    expect(isBareOrigin('wiki.example.corp')).toBe(false)
    expect(isBareOrigin('')).toBe(false)
  })

  // id 는 SDK MCP 서버 이름(`<id>-tools`)과 `${BINDING:<id>}` 파서로 흘러간다. 범위 밖 문자는
  // 등록·로그인·vault 저장을 전부 통과하고 도구 노출만 조용히 깨뜨리므로 여기서 잡는다.
  it('케밥 소문자가 아닌 id 는 거부한다', () => {
    const { definitions, rejected } = registerAuthDefinitions([
      { ...provider('Confluence DC', 'https://wiki.example.corp') },
      { ...provider('wiki_dc', 'https://wiki.example.corp') },
      { ...provider('wiki-dc', 'https://wiki.example.corp') }
    ])
    expect(definitions.map((p) => p.id)).toEqual(['wiki-dc'])
    expect(rejected.map((r) => r.reason)).toEqual(['invalid_id', 'invalid_id'])
  })

  // 0188 — Auth 코어는 gate 를 모른다. probe 없는 gate 의 거부는 여기가 아니라
  // `features/gate` 의 `selectGateMembers` 가 한다(그쪽 테스트가 그 계약을 잠근다).
  // 여기서는 **probe 유무와 무관하게 등록된다**는 것만 확인한다.
  it('probe 가 없어도 등록 자체는 통과한다 (gate 판정은 소비 측 책임)', () => {
    const { definitions, rejected } = registerAuthDefinitions([
      provider('sso', 'https://adfs.example.corp'),
      provider('wiki', 'https://wiki.example.corp')
    ])
    expect(definitions.map((p) => p.id)).toEqual(['sso', 'wiki'])
    expect(rejected).toEqual([])
  })

  it('id 로 조회한다', () => {
    const registry = new AuthRegistry([
      { ...provider('sso', 'https://adfs.example.corp'), probe: { path: '/api/me' } },
      provider('wiki', 'https://wiki.example.corp')
    ])
    expect(registry.list().map((p) => p.id)).toEqual(['sso', 'wiki'])
    expect(registry.get('wiki')?.label).toBe('wiki')
    expect(registry.get('nope')).toBeUndefined()
  })
})
