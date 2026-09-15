import { describe, expect, it } from 'vitest'
import { ClaudeAdapter } from './claude'
import { claudeAgentKindEnv } from './claude-agent-kind-env'
import { MockAdapter } from './mock'

const EXPECTED = {
  work: {
    CLAUDE_CODE_ENABLE_TODO_TOOLS: '1',
    CLAUDE_CODE_ENABLE_TASKS: '1',
    CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1'
  },
  code: {
    CLAUDE_CODE_ENABLE_TODO_TOOLS: null,
    CLAUDE_CODE_ENABLE_TASKS: null,
    CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: null
  }
} as const

describe('Claude agent-kind spawn env policy', () => {
  it.each(['work', 'code'] as const)('returns the literal %s policy table', (agentKind) => {
    const patch = claudeAgentKindEnv(agentKind)

    expect(patch).toEqual(EXPECTED[agentKind])
    expect(Object.isFrozen(patch)).toBe(true)
  })

  it.each([
    ['ClaudeAdapter', new ClaudeAdapter()],
    ['MockAdapter', new MockAdapter(() => ({}) as never)]
  ])('%s delegates both kinds to the Claude policy SSOT', (_name, adapter) => {
    expect(adapter.agentSpawnEnv('work')).toBe(claudeAgentKindEnv('work'))
    expect(adapter.agentSpawnEnv('code')).toBe(claudeAgentKindEnv('code'))
  })
})
