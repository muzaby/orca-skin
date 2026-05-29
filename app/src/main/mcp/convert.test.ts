import { describe, it, expect } from 'vitest'
import { toClaudecodeConfig, toOpencodeConfig } from './convert'
import type { Resolver } from './expand'
import type { OrcaMcpServers } from './schema'

const resolver =
  (map: Record<string, string> = {}): Resolver =>
  (n) =>
    map[n]

describe('toClaudecodeConfig', () => {
  it('stdio 서버를 env 와 함께 매핑한다', () => {
    const src: OrcaMcpServers = {
      gh: { command: 'gh-mcp', args: ['serve'], env: { TOKEN: '${T}' } }
    }
    const { config, dropped } = toClaudecodeConfig(src, resolver({ T: 'sec' }))
    expect(dropped).toEqual([])
    expect(config.gh).toEqual({
      type: 'stdio',
      command: 'gh-mcp',
      args: ['serve'],
      env: { TOKEN: 'sec' }
    })
  })

  it('http 서버를 headers 와 함께 매핑한다', () => {
    const src: OrcaMcpServers = {
      api: { type: 'http', url: 'https://x', headers: { Authorization: 'Bearer ${K}' } }
    }
    const { config } = toClaudecodeConfig(src, resolver({ K: 'abc' }))
    expect(config.api).toEqual({
      type: 'http',
      url: 'https://x',
      headers: { Authorization: 'Bearer abc' }
    })
  })

  it('sse 는 프로그래매틱 mcpServers 에서 http 로 강제된다', () => {
    const src: OrcaMcpServers = { s: { type: 'sse', url: 'https://sse' } }
    const { config } = toClaudecodeConfig(src, resolver())
    expect(config.s).toEqual({ type: 'http', url: 'https://sse' })
  })

  it('미해결 변수 서버를 dropped 로 전파한다', () => {
    const src: OrcaMcpServers = { bad: { command: 'c', env: { T: '${MISSING}' } } }
    const { config, dropped } = toClaudecodeConfig(src, resolver())
    expect(config).toEqual({})
    expect(dropped[0].name).toBe('bad')
  })

  it('빈 소스는 빈 config', () => {
    expect(toClaudecodeConfig({}, resolver())).toEqual({ config: {}, dropped: [] })
  })
})

describe('toOpencodeConfig', () => {
  it('stdio → local (command 배열) 매핑', () => {
    const src: OrcaMcpServers = {
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
    const src: OrcaMcpServers = {
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
