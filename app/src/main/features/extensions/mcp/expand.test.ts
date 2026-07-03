import { describe, it, expect } from 'vitest'
import { expandEnv } from './expand'
import { expandVars, type Resolver } from '../../../infra/vars'
import type { OrcaMcpConfig } from '../../../adapters/mcp-config'

const resolver =
  (map: Record<string, string>): Resolver =>
  (n) =>
    map[n]

describe('expandEnv', () => {
  it('정의된 ${VAR} 를 stdio env 에서 치환한다', () => {
    const src: OrcaMcpConfig = {
      gh: { command: 'gh-mcp', env: { TOKEN: '${GH_TOKEN}' } }
    }
    const { servers, dropped } = expandEnv(src, resolver({ GH_TOKEN: 'secret123' }))
    expect(dropped).toEqual([])
    expect(servers.gh).toMatchObject({ env: { TOKEN: 'secret123' } })
  })

  it('http headers 의 ${VAR} 도 치환한다', () => {
    const src: OrcaMcpConfig = {
      api: { type: 'http', url: 'https://x', headers: { Authorization: 'Bearer ${KEY}' } }
    }
    const { servers, dropped } = expandEnv(src, resolver({ KEY: 'abc' }))
    expect(dropped).toEqual([])
    expect(servers.api).toMatchObject({ headers: { Authorization: 'Bearer abc' } })
  })

  it('한 문자열의 여러 ${VAR} 를 모두 치환한다', () => {
    const src: OrcaMcpConfig = {
      s: { command: 'c', env: { U: '${A}-${B}' } }
    }
    const { servers } = expandEnv(src, resolver({ A: '1', B: '2' }))
    expect(servers.s).toMatchObject({ env: { U: '1-2' } })
  })

  it('미해결 ${VAR} 가 있으면 서버를 드롭하고 사유를 기록한다 (빈 문자열 치환 금지)', () => {
    const src: OrcaMcpConfig = {
      bad: { command: 'c', env: { T: '${MISSING}' } },
      good: { command: 'c2' }
    }
    const { servers, dropped } = expandEnv(src, resolver({}))
    expect(servers).toEqual({ good: { command: 'c2', env: undefined } })
    expect(dropped).toHaveLength(1)
    expect(dropped[0].name).toBe('bad')
    expect(dropped[0].reason).toContain('MISSING')
  })

  it('변수 없는 서버는 그대로 통과한다', () => {
    const src: OrcaMcpConfig = { plain: { command: 'c', args: ['x'] } }
    const { servers, dropped } = expandEnv(src, resolver({}))
    expect(dropped).toEqual([])
    expect(servers.plain).toMatchObject({ command: 'c', args: ['x'] })
  })

  it('빈 소스는 빈 결과', () => {
    expect(expandEnv({}, resolver({}))).toEqual({ servers: {}, dropped: [] })
  })
})

describe('expandVars', () => {
  it('평문은 그대로 반환한다', () => {
    expect(expandVars('plain', resolver({}))).toBe('plain')
  })

  it('정의된 ${VAR} 를 치환하고 missing 을 비워 둔다', () => {
    const missing = new Set<string>()
    expect(expandVars('Bearer ${TOKEN}', resolver({ TOKEN: 'secret' }), missing)).toBe(
      'Bearer secret'
    )
    expect([...missing]).toEqual([])
  })

  it('미해결 ${VAR} 를 missing 에 기록한다', () => {
    const missing = new Set<string>()
    expect(expandVars('${MISSING}', resolver({}), missing)).toBe('')
    expect([...missing]).toEqual(['MISSING'])
  })
})
