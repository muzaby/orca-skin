import { describe, expect, it } from 'vitest'
import type { InternalApi } from '../../../contracts/internal-api'
import { makeResolver, type AuthTokenSource } from './resolver'
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

describe('MCP resolver — ${BINDING:id} 참조 (AC10)', () => {
  const bindings = {
    token: (id: string) => (id === 'bind_1' ? 'pat-value' : null)
  }

  it('binding 참조를 broker 에 위임해 해석한다', () => {
    const resolve = makeResolver({ secrets: secrets(), bindings })
    expect(expandVars('${BINDING:bind_1}', resolve)).toBe('pat-value')
  })

  it('Bearer 접두사 등 사용자가 쓴 형식을 그대로 보존한다', () => {
    const resolve = makeResolver({ secrets: secrets(), bindings })
    expect(expandVars('Bearer ${BINDING:bind_1}', resolve)).toBe('Bearer pat-value')
  })

  it('알 수 없는 binding 은 미해결로 남는다 (서버 드롭 유도)', () => {
    const resolve = makeResolver({ secrets: secrets(), bindings })
    const missing = new Set<string>()
    expandVars('${BINDING:nope}', resolve, missing)
    expect([...missing]).toEqual(['BINDING:nope'])
  })

  it('broker 미주입이면 binding 참조가 해석되지 않는다', () => {
    const resolve = makeResolver({ secrets: secrets() })
    const missing = new Set<string>()
    expandVars('${BINDING:bind_1}', resolve, missing)
    expect(missing.size).toBe(1)
  })

  it('${VAR} 와 ${BINDING:} 이 한 문자열에서 함께 동작한다 (하위호환)', () => {
    const resolve = makeResolver({ secrets: secrets({ HOST: 'wiki.corp' }), bindings })
    expect(expandVars('https://${HOST}/x?t=${BINDING:bind_1}', resolve)).toBe(
      'https://wiki.corp/x?t=pat-value'
    )
  })

  it('binding id 는 env-var 이름으로 오인되지 않는다', () => {
    // ${BINDING:...} 는 VAR_RE 와 서로소라 env 조회로 새지 않는다.
    const resolve = makeResolver({ secrets: secrets({ 'BINDING:bind_1': 'wrong' }), bindings })
    expect(expandVars('${BINDING:bind_1}', resolve)).toBe('pat-value')
  })
})

// 인증 포트는 **계약에서 좁혀 온다** (0178 정정). 손으로 다시 선언하면 이 대입이 깨진다 —
// 소비자마다 자기 형상을 만들면 인증이 "모듈이 부르는 하나의 API" 이기를 그만둔다.
describe('인증 포트는 InternalApi 에서 파생된다', () => {
  it('AuthTokenSource 는 InternalApi 의 부분집합이다', () => {
    const port: AuthTokenSource = { token: () => 'v' }
    const narrowed: Pick<InternalApi, 'token'> = port
    expect(narrowed.token('any')).toBe('v')
  })
})
