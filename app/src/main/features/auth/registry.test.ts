import { describe, expect, it } from 'vitest'
import type { Provider } from '../../contracts/auth'
import { isBareOrigin, ProviderRegistry, registerProviders } from './registry'

function provider(id: string, origin: string): Provider {
  return { id, label: id, kind: 'service', origin, auth: [] }
}

describe('ProviderRegistry (AC1)', () => {
  it('중복 id 와 비-origin 을 거부하고 나머지는 등록한다', () => {
    const { providers, rejected } = registerProviders([
      provider('wiki', 'https://wiki.example.corp'),
      // 중복 — 뒤에 온 선언이 조용히 덮어쓰지 않는다(vault 네임스페이스가 겹친다).
      provider('wiki', 'https://other.example.corp'),
      // 경로가 붙은 값은 origin 이 아니다.
      provider('jira', 'https://jira.example.corp/context'),
      provider('gw', 'https://gw.example.corp:8443')
    ])

    // 거부된 둘만 빠지고 나머지 둘은 그대로 등록된다 — 패키지 단위 all-or-nothing 이 아니다.
    expect(providers.map((p) => p.id)).toEqual(['wiki', 'gw'])
    expect(providers[0]?.origin).toBe('https://wiki.example.corp')
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
    const { providers, rejected } = registerProviders([
      { ...provider('Confluence DC', 'https://wiki.example.corp') },
      { ...provider('wiki_dc', 'https://wiki.example.corp') },
      { ...provider('wiki-dc', 'https://wiki.example.corp') }
    ])
    expect(providers.map((p) => p.id)).toEqual(['wiki-dc'])
    expect(rejected.map((r) => r.reason)).toEqual(['invalid_id', 'invalid_id'])
  })

  // 게이트는 앱의 출입문이다. 확인 수단 없이 등록하면 "열려는 있는데 아무나 통과" 가 된다.
  it('probe 없는 게이트는 거부하고 나머지는 등록한다', () => {
    const { providers, rejected } = registerProviders([
      { ...provider('sso', 'https://adfs.example.corp'), kind: 'gate' },
      provider('wiki', 'https://wiki.example.corp')
    ])
    expect(providers.map((p) => p.id)).toEqual(['wiki'])
    expect(rejected).toEqual([{ id: 'sso', reason: 'missing_probe', message: expect.any(String) }])
  })

  it('kind 별 조회가 게이트 판정의 입력을 만든다', () => {
    const registry = new ProviderRegistry([
      { ...provider('sso', 'https://adfs.example.corp'), kind: 'gate', probe: { path: '/api/me' } },
      provider('wiki', 'https://wiki.example.corp')
    ])
    expect(registry.byKind('gate').map((p) => p.id)).toEqual(['sso'])
    expect(registry.byKind('llm')).toEqual([])
    expect(registry.get('wiki')?.label).toBe('wiki')
    expect(registry.get('nope')).toBeUndefined()
  })
})
