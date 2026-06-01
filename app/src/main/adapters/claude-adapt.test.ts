import { describe, it, expect } from 'vitest'
import {
  makeClaudeHookCallback,
  adaptHooks,
  adaptMcp,
  adaptSkills,
  adaptSystemPrompt,
  toClaudeHookOutput,
  toContext
} from './claude-adapt'
import type { OrcaHookHandler } from '../capabilities/hooks'

describe('adaptMcp', () => {
  it('빈 config 는 옵션 생략', () => {
    expect(adaptMcp({})).toEqual({})
  })

  it('서버가 있으면 mcpServers + allowedTools(`mcp__<name>__*`)', () => {
    const out = adaptMcp({
      gh: { command: 'gh-mcp' },
      api: { type: 'http', url: 'https://x' }
    }) as { mcpServers: object; allowedTools: string[] }
    expect(out.mcpServers).toEqual({
      gh: { command: 'gh-mcp' },
      api: { type: 'http', url: 'https://x' }
    })
    expect(out.allowedTools).toEqual(['mcp__gh__*', 'mcp__api__*'])
  })
})

describe('adaptSystemPrompt', () => {
  it('빈/공백 append 는 옵션 생략', () => {
    expect(adaptSystemPrompt(undefined)).toEqual({})
    expect(adaptSystemPrompt('   ')).toEqual({})
  })

  it('텍스트가 있으면 claude_code preset + append', () => {
    expect(adaptSystemPrompt('rules')).toEqual({
      systemPrompt: { type: 'preset', preset: 'claude_code', append: 'rules' }
    })
  })
})

describe('adaptSkills', () => {
  it('항상 plugins(local) + skills:all 구조를 반환', () => {
    const out = adaptSkills() as { plugins: { type: string; path: string }[]; skills: string }
    expect(out.plugins[0].type).toBe('local')
    expect(typeof out.plugins[0].path).toBe('string')
    expect(out.skills).toBe('all')
  })
})

describe('adaptHooks', () => {
  it('빈 normalized 는 옵션 생략 (실런타임 경로 — options.hooks 미주입)', () => {
    expect(adaptHooks({ normalized: {} })).toEqual({})
  })

  it('핸들러가 있으면 hooks 매처를 만든다', () => {
    const out = adaptHooks({
      normalized: { 'before-tool': [() => ({})] }
    }) as { hooks: Record<string, unknown[]> }
    expect(out.hooks).toBeDefined()
    expect(out.hooks.PreToolUse).toHaveLength(1)
  })
})

describe('toContext', () => {
  it('snake_case → camelCase 매핑 + raw 패스스루', () => {
    const signal = new AbortController().signal
    const input = {
      session_id: 's1',
      cwd: '/x',
      tool_name: 'Write',
      tool_input: { file_path: '/x/.env' }
    }
    const ctx = toContext('before-tool', input, signal)
    expect(ctx.event).toBe('before-tool')
    expect(ctx.sessionId).toBe('s1')
    expect(ctx.cwd).toBe('/x')
    expect(ctx.toolName).toBe('Write')
    expect(ctx.toolInput).toEqual({ file_path: '/x/.env' })
    expect(ctx.raw).toBe(input)
  })

  it('after-tool 의 tool_response 를 toolOutput 으로 매핑', () => {
    const ctx = toContext('after-tool', { tool_response: 'done' }, new AbortController().signal)
    expect(ctx.toolOutput).toBe('done')
  })
})

describe('toClaudeHookOutput', () => {
  it('before-tool deny → permissionDecision', () => {
    const out = toClaudeHookOutput('before-tool', { decision: 'deny', reason: 'no' }) as {
      hookSpecificOutput: {
        hookEventName: string
        permissionDecision: string
        permissionDecisionReason: string
      }
    }
    expect(out.hookSpecificOutput.hookEventName).toBe('PreToolUse')
    expect(out.hookSpecificOutput.permissionDecision).toBe('deny')
    expect(out.hookSpecificOutput.permissionDecisionReason).toBe('no')
  })

  it('after-tool → additionalContext + updatedToolOutput', () => {
    const out = toClaudeHookOutput('after-tool', {
      injectContext: 'ctx',
      updatedToolOutput: 'replaced'
    }) as { hookSpecificOutput: { additionalContext: string; updatedToolOutput: unknown } }
    expect(out.hookSpecificOutput.additionalContext).toBe('ctx')
    expect(out.hookSpecificOutput.updatedToolOutput).toBe('replaced')
  })

  it('continue:false 는 최상위로', () => {
    const out = toClaudeHookOutput('on-turn-end', { continue: false }) as { continue: boolean }
    expect(out.continue).toBe(false)
  })
})

describe('makeClaudeHookCallback', () => {
  // .env-protect 핸들러 — 단위 테스트 픽스처(빌트인 미탑재, 래퍼가 deny 를 만드는지만 증명).
  const protectEnv: OrcaHookHandler = (ctx) => {
    const input = ctx.toolInput as { file_path?: string } | undefined
    const name = input?.file_path?.split('/').pop()
    if (name === '.env') return { decision: 'deny', reason: 'Cannot modify .env files' }
    return {}
  }

  it('가짜 snake_case PreToolUse(.env) → permissionDecision deny', async () => {
    const cb = makeClaudeHookCallback('before-tool', [protectEnv])
    const result = (await cb(
      {
        session_id: 's',
        cwd: '/x',
        tool_name: 'Write',
        tool_input: { file_path: '/x/.env' },
        hook_event_name: 'PreToolUse'
      } as never,
      undefined,
      { signal: new AbortController().signal }
    )) as { hookSpecificOutput?: { permissionDecision?: string } }
    expect(result.hookSpecificOutput?.permissionDecision).toBe('deny')
  })

  it('.env 가 아니면 변경 없이 허용 ({})', async () => {
    const cb = makeClaudeHookCallback('before-tool', [protectEnv])
    const result = await cb(
      {
        session_id: 's',
        cwd: '/x',
        tool_name: 'Write',
        tool_input: { file_path: '/x/app.ts' },
        hook_event_name: 'PreToolUse'
      } as never,
      undefined,
      { signal: new AbortController().signal }
    )
    expect(result).toEqual({})
  })
})
