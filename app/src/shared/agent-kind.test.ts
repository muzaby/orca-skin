import { describe, expect, it } from 'vitest'
import * as agentKind from './agent-kind'

type AgentKindApi = typeof agentKind & {
  parseAgentKind?: (value: unknown) => agentKind.AgentKind
  readLegacyAgentKind?: (value: unknown) => agentKind.AgentKind
}

const api = agentKind as AgentKindApi

describe('agent kind boundaries', () => {
  it('accepts only current code and work values', () => {
    expect(api.parseAgentKind).toBeTypeOf('function')
    if (!api.parseAgentKind) return

    expect(api.parseAgentKind('code')).toBe('code')
    expect(api.parseAgentKind('work')).toBe('work')
    for (const invalid of ['coding', 'cowork', '', null, undefined, true]) {
      expect(() => api.parseAgentKind?.(invalid)).toThrow('Invalid agent kind')
    }
  })

  it('converts only the documented legacy value and missing field', () => {
    expect(api.readLegacyAgentKind).toBeTypeOf('function')
    if (!api.readLegacyAgentKind) return

    expect(api.readLegacyAgentKind(undefined)).toBe('code')
    expect(api.readLegacyAgentKind('coding')).toBe('code')
    expect(api.readLegacyAgentKind('code')).toBe('code')
    expect(api.readLegacyAgentKind('work')).toBe('work')
    for (const invalid of [null, 'cowork', '', true]) {
      expect(() => api.readLegacyAgentKind?.(invalid)).toThrow('Invalid agent kind')
    }
  })
})
