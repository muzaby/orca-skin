import { describe, it, expect } from 'vitest'
import { toClaudeConfig } from './convert'
import type { Resolver } from '../../../infra/vars'
import type { OrcaMcpConfig } from '../../../adapters/mcp-config'

const resolver =
  (map: Record<string, string> = {}): Resolver =>
  (n) =>
    map[n]

describe('toClaudeConfig', () => {
  // Orca 정규형 == Claude 형식이므로 구조는 항등 — ${VAR} 확장만 일어난다.
  it('stdio 서버를 ${VAR} 확장해 항등 매핑한다', () => {
    const src: OrcaMcpConfig = {
      gh: { command: 'gh-mcp', args: ['serve'], env: { TOKEN: '${T}' } }
    }
    const { config, dropped } = toClaudeConfig(src, resolver({ T: 'sec' }))
    expect(dropped).toEqual([])
    expect(config.gh).toEqual({ command: 'gh-mcp', args: ['serve'], env: { TOKEN: 'sec' } })
  })

  it('http 서버를 headers 와 함께 항등 매핑한다', () => {
    const src: OrcaMcpConfig = {
      api: { type: 'http', url: 'https://x', headers: { Authorization: 'Bearer ${K}' } }
    }
    const { config } = toClaudeConfig(src, resolver({ K: 'abc' }))
    expect(config.api).toEqual({
      type: 'http',
      url: 'https://x',
      headers: { Authorization: 'Bearer abc' }
    })
  })

  it('sse 는 그대로 보존된다 (SDK 가 sse 트랜스포트를 지원)', () => {
    const src: OrcaMcpConfig = { s: { type: 'sse', url: 'https://sse' } }
    const { config } = toClaudeConfig(src, resolver())
    expect(config.s).toEqual({ type: 'sse', url: 'https://sse' })
  })

  it('미해결 변수 서버를 dropped 로 전파한다', () => {
    const src: OrcaMcpConfig = { bad: { command: 'c', env: { T: '${MISSING}' } } }
    const { config, dropped } = toClaudeConfig(src, resolver())
    expect(config).toEqual({})
    expect(dropped[0].name).toBe('bad')
  })

  it('빈 소스는 빈 config', () => {
    expect(toClaudeConfig({}, resolver())).toEqual({ config: {}, dropped: [] })
  })
})

describe('MCP variable expansion', () => {
  it('입력을 변경하지 않고 중복 미해결 변수의 사유와 정상 이웃 서버를 보존한다', () => {
    const src: OrcaMcpConfig = Object.freeze({
      bad: Object.freeze({
        command: 'bad-mcp',
        env: Object.freeze({ FIRST: '${A}-${B}-${A}', SECOND: '${B}' })
      }),
      good: Object.freeze({
        type: 'http' as const,
        url: 'https://example.test/mcp',
        headers: Object.freeze({ Authorization: 'Bearer ${TOKEN}' })
      })
    })
    const before = structuredClone(src)

    expect(toClaudeConfig(src, resolver({ TOKEN: 'test-token' }))).toEqual({
      config: {
        good: {
          type: 'http',
          url: 'https://example.test/mcp',
          headers: { Authorization: 'Bearer test-token' }
        }
      },
      dropped: [{ name: 'bad', reason: '미해결 환경변수: A, B' }]
    })
    expect(src).toEqual(before)
  })

  it('정의된 ${VAR} 를 stdio env 에서 치환한다', () => {
    const src: OrcaMcpConfig = {
      gh: { command: 'gh-mcp', env: { TOKEN: '${GH_TOKEN}' } }
    }
    const { config: servers, dropped } = toClaudeConfig(src, resolver({ GH_TOKEN: 'secret123' }))
    expect(dropped).toEqual([])
    expect(servers.gh).toMatchObject({ env: { TOKEN: 'secret123' } })
  })

  it('http headers 의 ${VAR} 도 치환한다', () => {
    const src: OrcaMcpConfig = {
      api: { type: 'http', url: 'https://x', headers: { Authorization: 'Bearer ${KEY}' } }
    }
    const { config: servers, dropped } = toClaudeConfig(src, resolver({ KEY: 'abc' }))
    expect(dropped).toEqual([])
    expect(servers.api).toMatchObject({ headers: { Authorization: 'Bearer abc' } })
  })

  it('한 문자열의 여러 ${VAR} 를 모두 치환한다', () => {
    const src: OrcaMcpConfig = {
      s: { command: 'c', env: { U: '${A}-${B}' } }
    }
    const { config: servers } = toClaudeConfig(src, resolver({ A: '1', B: '2' }))
    expect(servers.s).toMatchObject({ env: { U: '1-2' } })
  })

  it('미해결 ${VAR} 가 있으면 서버를 드롭하고 사유를 기록한다 (빈 문자열 치환 금지)', () => {
    const src: OrcaMcpConfig = {
      bad: { command: 'c', env: { T: '${MISSING}' } },
      good: { command: 'c2' }
    }
    const { config: servers, dropped } = toClaudeConfig(src, resolver({}))
    expect(servers).toEqual({ good: { command: 'c2', env: undefined } })
    expect(dropped).toHaveLength(1)
    expect(dropped[0].name).toBe('bad')
    expect(dropped[0].reason).toContain('MISSING')
  })

  it('변수 없는 서버는 그대로 통과한다', () => {
    const src: OrcaMcpConfig = { plain: { command: 'c', args: ['x'] } }
    const { config: servers, dropped } = toClaudeConfig(src, resolver({}))
    expect(dropped).toEqual([])
    expect(servers.plain).toMatchObject({ command: 'c', args: ['x'] })
  })

  it('빈 소스는 빈 결과', () => {
    expect(toClaudeConfig({}, resolver({}))).toEqual({ config: {}, dropped: [] })
  })
})
