import { describe, expect, it, vi } from 'vitest'
import {
  agentForProviderKey,
  authTokenFor,
  dedupeAgents,
  modelNameForFamily,
  providerKeyOf,
  toAgentEnvironments
} from './provider-key'
import type { OrcaAgentConfig } from './orca-file'

const base: OrcaAgentConfig = {
  adapter: 'claude-code',
  models: [
    { name: 'claude-sonnet-4-5', family: 'sonnet', default: true },
    { name: 'claude-haiku-4-5' }
  ]
}

describe('provider key helpers', () => {
  it('provider 부재/공백은 adapter 단독, provider 존재는 trim/lowercase 합성 키를 만든다', () => {
    expect(providerKeyOf(base)).toBe('claude-code')
    expect(providerKeyOf({ ...base, provider: '  BedRock ' })).toBe('claude-code-bedrock')
  })

  it('agentForProviderKey 는 생성 방향 매칭만 수행한다', () => {
    const agents = [base, { ...base, provider: 'bedrock' }]
    expect(agentForProviderKey(agents, 'claude-code-bedrock')?.provider).toBe('bedrock')
    expect(agentForProviderKey(agents, 'missing')).toBeUndefined()
  })

  it('dedupeAgents 는 같은 provider key 의 두 번째 이후 항목을 드롭하고 경고한다', () => {
    const warn = vi.fn()
    const agents = [base, { ...base, provider: ' BEDROCK ' }, { ...base, provider: 'bedrock' }]
    expect(dedupeAgents(agents, warn)).toHaveLength(2)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('claude-code-bedrock')
  })

  it('authTokenFor 는 secret store 를 우선하고 orca.json authToken 환경변수를 fallback 확장한다', () => {
    expect(
      authTokenFor(
        { ...base, authToken: '${TOKEN}' },
        {
          secretStore: {
            get: (key) => (key === 'provider:claude-code' ? 'secret-token' : undefined)
          },
          resolve: () => 'env-token'
        }
      )
    ).toBe('secret-token')
    expect(
      authTokenFor(
        { ...base, authToken: '${TOKEN}' },
        { resolve: (key) => (key === 'TOKEN' ? 'env-token' : undefined) }
      )
    ).toBe('env-token')
    expect(
      authTokenFor({ ...base, authToken: '${MISSING}' }, { resolve: () => undefined })
    ).toBeUndefined()
  })

  it('modelNameForFamily 는 family/name 매칭 후 default, 빈 배열이면 undefined 를 반환한다', () => {
    expect(modelNameForFamily(base, 'sonnet')).toBe('claude-sonnet-4-5')
    expect(modelNameForFamily(base, 'claude-haiku-4-5')).toBe('claude-haiku-4-5')
    expect(modelNameForFamily(base, 'missing')).toBe('claude-sonnet-4-5')
    expect(modelNameForFamily({ ...base, models: [] }, 'sonnet')).toBeUndefined()
  })

  it('toAgentEnvironments 는 renderer DTO 에 비밀/env/baseUrl 필드를 노출하지 않는다', () => {
    const envs = toAgentEnvironments(
      [
        {
          ...base,
          provider: 'bedrock',
          authToken: 'plain',
          baseUrl: 'https://example.test',
          env: { A: 'B' }
        }
      ],
      ['claude-code']
    )
    expect(envs[0]).toEqual({
      key: 'claude-code-bedrock',
      adapter: 'claude-code',
      provider: 'bedrock',
      supported: true,
      models: [
        { name: 'claude-sonnet-4-5', family: 'sonnet', default: true },
        { name: 'claude-haiku-4-5' }
      ]
    })
    expect('authToken' in envs[0]).toBe(false)
    expect('baseUrl' in envs[0]).toBe(false)
    expect('env' in envs[0]).toBe(false)
  })
})
