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

// 0180 — 토큰 소스가 사라졌다. `${BINDING:…}` 는 **항상 미해결**이고, expand.ts 가 그 서버를
// 통째로 드롭한다(fail-closed 유지). 0181 이 provider 물질화로 이 자리를 채운다.
describe('MCP resolver — 토큰 소스 없이 동작한다 (0180 AC4)', () => {
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
})
