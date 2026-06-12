import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

let root: string

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

describe('ClaudeCodeAdapter query provider settings materialization', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-claude-query-options-'))
    sdkMock.query.mockReset()
    sdkMock.query.mockReturnValue(sdkMock.handle)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('sendMessage 는 source settings 를 cwd/.claude/settings.local.json 으로 복사하고 settings/settingSources 를 주입하지 않는다', () => {
    const cwd = join(root, 'work')
    const source = join(root, 'sources', 'settings', 'claude-code', 'bedrock', 'settings.json')
    mkdirSync(join(source, '..'), { recursive: true })
    writeFileSync(source, '{"env":{"CLAUDE_CODE_USE_BEDROCK":"1"}}', 'utf8')

    const adapter = new ClaudeCodeAdapter(() => () => undefined)
    adapter.sendMessage({
      sessionId: null,
      text: 'hello',
      cwd,
      extensions: extensions(),
      env: { PATH: '/bin' },
      providerSettings: {
        providerKey: 'claude-code-bedrock',
        provider: 'bedrock',
        sourcesSettingsFile: source,
        settings: { env: { CLAUDE_CODE_USE_BEDROCK: '1' } }
      }
    })

    expect(readFileSync(join(cwd, '.claude', 'settings.local.json'), 'utf8')).toBe(
      '{"env":{"CLAUDE_CODE_USE_BEDROCK":"1"}}'
    )
    const options = sdkMock.query.mock.calls[0][0].options
    expect(options.env).toEqual({ PATH: '/bin' })
    expect(options).not.toHaveProperty('settings')
    expect(options).not.toHaveProperty('settingSources')
  })
})
