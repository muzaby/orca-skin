import { describe, expect, it, vi } from 'vitest'
import { mergeAgentEnv, toClaudeEnv } from './claude-env'
import type { Resolver } from '../mcp/expand'

const resolver =
  (map: Record<string, string>): Resolver =>
  (name) =>
    map[name]

describe('toClaudeEnv', () => {
  it('provider bedrock/vertex 를 claude-code env 로 매핑한다', () => {
    expect(
      toClaudeEnv({ adapter: 'claude-code', provider: 'bedrock', models: [] }, resolver({})).env
    ).toEqual({ CLAUDE_CODE_USE_BEDROCK: '1' })
    expect(
      toClaudeEnv({ adapter: 'claude-code', provider: 'vertex', models: [] }, resolver({})).env
    ).toEqual({ CLAUDE_CODE_USE_VERTEX: '1' })
  })

  it('provider anthropic/부재는 추가 env 가 없다', () => {
    expect(
      toClaudeEnv({ adapter: 'claude-code', provider: 'anthropic', models: [] }, resolver({})).env
    ).toEqual({})
    expect(toClaudeEnv({ adapter: 'claude-code', models: [] }, resolver({})).env).toEqual({})
  })

  it('미지 provider 는 agent 를 드롭하지 않고 경고 후 무시한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = toClaudeEnv(
      { adapter: 'claude-code', provider: 'unknown', apiKey: 'plain', models: [] },
      resolver({})
    )
    expect(result.env).toEqual({ ANTHROPIC_API_KEY: 'plain' })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('apiKey/baseUrl 평문과 ${VAR} 를 매핑한다', () => {
    const result = toClaudeEnv(
      {
        adapter: 'claude-code',
        apiKey: 'plain-key',
        baseUrl: '${BASE_URL}',
        models: []
      },
      resolver({ BASE_URL: 'https://api.example.test' })
    )
    expect(result).toEqual({
      env: { ANTHROPIC_API_KEY: 'plain-key', ANTHROPIC_BASE_URL: 'https://api.example.test' },
      missing: []
    })
  })

  it('빈 문자열과 공백-only 필드는 부재 처리한다', () => {
    const result = toClaudeEnv(
      { adapter: 'claude-code', apiKey: ' ', baseUrl: '', models: [] },
      resolver({})
    )
    expect(result.env).toEqual({})
  })

  it('미해결 ${VAR} 는 해당 env 키만 드롭한다', () => {
    const result = toClaudeEnv(
      {
        adapter: 'claude-code',
        apiKey: '${MISSING}',
        baseUrl: 'https://ok',
        env: { AWS_REGION: '${AWS_REGION}', KEEP: 'plain' },
        models: []
      },
      resolver({ AWS_REGION: 'us-west-2' })
    )
    expect(result.env).toEqual({
      ANTHROPIC_BASE_URL: 'https://ok',
      AWS_REGION: 'us-west-2',
      KEEP: 'plain'
    })
    expect(result.missing).toEqual(['MISSING'])
  })

  it('env 레코드가 매핑 키보다 우선한다', () => {
    const result = toClaudeEnv(
      {
        adapter: 'claude-code',
        apiKey: 'field-key',
        env: { ANTHROPIC_API_KEY: 'env-key' },
        models: []
      },
      resolver({})
    )
    expect(result.env.ANTHROPIC_API_KEY).toBe('env-key')
  })

  it('agent undefined 는 빈 env 를 반환한다', () => {
    expect(toClaudeEnv(undefined, resolver({}))).toEqual({ env: {}, missing: [] })
  })
})

describe('mergeAgentEnv', () => {
  it('agentEnv 가 비면 base 를 그대로 반환한다', () => {
    const base = { PATH: '/bin' }
    expect(mergeAgentEnv(base, {})).toBe(base)
    expect(mergeAgentEnv(undefined, {})).toBeUndefined()
  })

  it('base 를 보존하고 agentEnv 가 우선한다', () => {
    expect(mergeAgentEnv({ PATH: '/bin', A: 'base' }, { A: 'agent', B: 'agent' })).toEqual({
      PATH: '/bin',
      A: 'agent',
      B: 'agent'
    })
  })
})
