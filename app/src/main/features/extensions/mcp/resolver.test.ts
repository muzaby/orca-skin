import { describe, expect, it } from 'vitest'
import { makeResolver } from './resolver'
import { expandVars } from '../../../infra/vars'
import type { SecretStore } from '../../../infra/config/secret-store'

function secrets(entries: Record<string, string> = {}): SecretStore {
  const map = new Map(Object.entries(entries))
  return {
    get: (name: string) => map.get(name),
    set: (name: string, plain: string) => void map.set(name, plain),
    has: (name: string) => map.has(name),
    delete: (name: string) => void map.delete(name)
  } as unknown as SecretStore
}

describe('MCP resolver — process.env 전체 fallback 제거 (AC11)', () => {
  it('vault 에 봉인된 비밀을 해석한다', () => {
    const resolve = makeResolver({ secrets: secrets({ WIKI_TOKEN: 'sealed' }) })
    expect(resolve('WIKI_TOKEN')).toBe('sealed')
  })

  it('allowlist 에 없는 이름은 process.env 에 있어도 보이지 않는다', () => {
    process.env.ORCA_TEST_LEAK = 'should-not-leak'
    try {
      const resolve = makeResolver({ secrets: secrets() })
      expect(resolve('ORCA_TEST_LEAK')).toBeUndefined()
    } finally {
      delete process.env.ORCA_TEST_LEAK
    }
  })

  it('allowlist 에 정확히 적은 이름만 env fallback 을 허용한다', () => {
    process.env.ORCA_TEST_ALLOWED = 'ok'
    process.env.ORCA_TEST_OTHER = 'nope'
    try {
      const resolve = makeResolver({
        secrets: secrets(),
        envAllowlist: ['ORCA_TEST_ALLOWED']
      })
      expect(resolve('ORCA_TEST_ALLOWED')).toBe('ok')
      expect(resolve('ORCA_TEST_OTHER')).toBeUndefined()
    } finally {
      delete process.env.ORCA_TEST_ALLOWED
      delete process.env.ORCA_TEST_OTHER
    }
  })

  it('접두사 일치로 allowlist 를 우회할 수 없다', () => {
    process.env.ORCA_TEST_ALLOWED_EXTRA = 'sneaky'
    try {
      const resolve = makeResolver({ secrets: secrets(), envAllowlist: ['ORCA_TEST_ALLOWED'] })
      expect(resolve('ORCA_TEST_ALLOWED_EXTRA')).toBeUndefined()
    } finally {
      delete process.env.ORCA_TEST_ALLOWED_EXTRA
    }
  })

  it('vault 가 allowlist env 보다 우선한다', () => {
    process.env.ORCA_TEST_BOTH = 'from-env'
    try {
      const resolve = makeResolver({
        secrets: secrets({ ORCA_TEST_BOTH: 'from-vault' }),
        envAllowlist: ['ORCA_TEST_BOTH']
      })
      expect(resolve('ORCA_TEST_BOTH')).toBe('from-vault')
    } finally {
      delete process.env.ORCA_TEST_BOTH
    }
  })
})

// 0181 AC10 — `ProviderApi.token` 이 토큰 소스로 다시 주입된다. 소스가 없거나 그 대상이
// 미인증이면 여전히 미해결로 남아 expand.ts 가 서버를 통째로 드롭한다(fail-closed 유지).
describe('MCP resolver — 대상 참조 (AC10)', () => {
  it('토큰 소스 없이 ${VAR} 서버를 해소한다', () => {
    const resolve = makeResolver({ secrets: secrets({ HOST: 'wiki.corp', TOKEN: 'sealed' }) })
    const missing = new Set<string>()
    expect(expandVars('https://${HOST}/x?t=${TOKEN}', resolve, missing)).toBe(
      'https://wiki.corp/x?t=sealed'
    )
    expect(missing.size).toBe(0)
  })

  it('대상 참조는 미해결로 남아 서버 드롭을 유도한다', () => {
    const resolve = makeResolver({ secrets: secrets() })
    const missing = new Set<string>()
    expandVars('${BINDING:wiki}', resolve, missing)
    expect([...missing]).toEqual(['BINDING:wiki'])
  })

  it('대상 이름은 vault 조회로 새지 않는다', () => {
    // ${BINDING:...} 는 VAR_RE 와 서로소라, 같은 이름이 vault 에 있어도 읽지 않는다.
    const resolve = makeResolver({ secrets: secrets({ 'BINDING:wiki': 'leaked' }) })
    const missing = new Set<string>()
    expandVars('${BINDING:wiki}', resolve, missing)
    expect([...missing]).toEqual(['BINDING:wiki'])
  })

  it('토큰 소스 주입 시 대상을 해소한다', () => {
    const resolve = makeResolver({
      secrets: secrets(),
      tokens: (providerId) => (providerId === 'wiki' ? 'wiki-token' : null)
    })
    const missing = new Set<string>()
    expect(expandVars('https://x/?t=${BINDING:wiki}', resolve, missing)).toBe(
      'https://x/?t=wiki-token'
    )
    expect(missing.size).toBe(0)
  })

  it('미인증 대상은 미해결로 남는다', () => {
    // 소스는 있는데 그 provider 가 미인증이면 null → undefined 로 접힌다. 빈 문자열로 채우면
    // 인증 없는 요청을 하는 MCP 서버가 조용히 배포된다.
    const resolve = makeResolver({ secrets: secrets(), tokens: () => null })
    const missing = new Set<string>()
    expandVars('${BINDING:wiki}', resolve, missing)
    expect([...missing]).toEqual(['BINDING:wiki'])
  })

  it('토큰 소스는 대상 참조에만 쓰인다 — 일반 ${VAR} 를 가로채지 않는다', () => {
    const seen: string[] = []
    const resolve = makeResolver({
      secrets: secrets({ TOKEN: 'sealed' }),
      tokens: (providerId) => {
        seen.push(providerId)
        return 'from-provider'
      }
    })
    expect(resolve('TOKEN')).toBe('sealed')
    expect(seen).toEqual([])
  })
})
