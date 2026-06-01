import { describe, it, expect } from 'vitest'
import { toClaudeConfig, toOpencodeConfig } from './convert'
import type { Resolver } from './expand'
import type { OrcaMcpConfig } from './schema'

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

describe('toOpencodeConfig', () => {
  it('stdio → local (command 배열) 매핑', () => {
    const src: OrcaMcpConfig = {
      gh: { command: 'gh-mcp', args: ['serve'], env: { TOKEN: '${T}' } }
    }
    const { config, dropped } = toOpencodeConfig(src, resolver({ T: 'sec' }))
    expect(dropped).toEqual([])
    expect(config.gh).toEqual({
      type: 'local',
      command: ['gh-mcp', 'serve'],
      environment: { TOKEN: 'sec' },
      enabled: true
    })
  })

  it('http/sse → remote 매핑', () => {
    const src: OrcaMcpConfig = {
      api: { type: 'http', url: 'https://x', headers: { A: '${K}' } },
      ev: { type: 'sse', url: 'https://sse' }
    }
    const { config } = toOpencodeConfig(src, resolver({ K: 'v' }))
    expect(config.api).toEqual({
      type: 'remote',
      url: 'https://x',
      headers: { A: 'v' },
      enabled: true
    })
    expect(config.ev).toEqual({ type: 'remote', url: 'https://sse', enabled: true })
  })

  it('미해결 변수는 dropped, 빈 소스는 빈 config', () => {
    expect(toOpencodeConfig({}, resolver())).toEqual({ config: {}, dropped: [] })
    const { config, dropped } = toOpencodeConfig(
      { bad: { command: 'c', env: { T: '${X}' } } },
      resolver()
    )
    expect(config).toEqual({})
    expect(dropped[0].name).toBe('bad')
  })
})
