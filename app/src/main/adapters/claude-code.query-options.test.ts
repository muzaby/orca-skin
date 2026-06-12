import { describe, it, expect, vi, beforeEach } from 'vitest'

const sdkMock = vi.hoisted(() => ({
  query: vi.fn(),
  handle: Object.assign(
    (async function* () {
      // empty stream
    })(),
    {
      setPermissionMode: vi.fn(),
      interrupt: vi.fn(),
      setModel: vi.fn()
    }
  )
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: sdkMock.query
}))

import { ClaudeCodeAdapter } from './claude-code'

function extensions(): {
  mcp: Record<string, never>
  skills: []
  hooks: { normalized: Record<string, never> }
} {
  return {
    mcp: {},
    skills: [],
    hooks: { normalized: {} }
  }
}

describe('ClaudeCodeAdapter query provider env options', () => {
  beforeEach(() => {
    sdkMock.query.mockReset()
    sdkMock.query.mockReturnValue(sdkMock.handle)
  })

  it('sendMessage 는 provider env 를 options.env 로 병합하고 settings/settingSources 를 주입하지 않는다', () => {
    const adapter = new ClaudeCodeAdapter(() => () => undefined)
    adapter.sendMessage({
      sessionId: null,
      text: 'hello',
      cwd: '/tmp/orca',
      extensions: extensions(),
      env: { PATH: '/bin', A: 'base' },
      providerSettings: {
        providerKey: 'claude-code-bedrock',
        provider: 'bedrock',
        env: { A: 'provider', CLAUDE_CODE_USE_BEDROCK: '1' },
        settings: { env: { A: 'provider', CLAUDE_CODE_USE_BEDROCK: '1' }, model: 'ignored' }
      }
    })

    const options = sdkMock.query.mock.calls[0][0].options
    expect(options.env).toMatchObject({
      PATH: '/bin',
      A: 'provider',
      CLAUDE_CODE_USE_BEDROCK: '1'
    })
    expect(options).not.toHaveProperty('settings')
    expect(options).not.toHaveProperty('settingSources')
  })
})
