import { describe, it, expect } from 'vitest'
import {
  makeClaudeHookCallback,
  adaptEnv,
  adaptHooks,
  adaptMcp,
  adaptSettings,
  adaptSkills,
  adaptSystemPrompt,
  toClaudeHookOutput,
  toContext
} from './claude-adapt'
import type { NormalizedHookHandler } from '../extensions/hooks'

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
  it('plugins(local) 없이 skills:all 필터만 반환한다', () => {
    expect(adaptSkills()).toEqual({ skills: 'all' })
  })
})

describe('adaptSettings', () => {
  it('settings 부재 시 옵션을 생략하고 settingSources 를 주입하지 않는다', () => {
    expect(adaptSettings(undefined)).toEqual({})
  })

  it('빈 settings 객체는 settings 옵션을 생략한다', () => {
    expect(adaptSettings({})).toEqual({})
  })

  it('settings 가 있으면 **인라인 JSON 문자열**로 직렬화해 주입한다 (handoff 0015)', () => {
    const raw = { model: 'claude-sonnet-4-6', permissions: { allow: ['Read'] } }
    const out = adaptSettings(raw) as { settings: string }
    expect('settingSources' in out).toBe(false)
    // SDK transport 가 문자열만 지원하므로 객체가 아니라 문자열이어야 한다.
    expect(typeof out.settings).toBe('string')
    expect(JSON.parse(out.settings)).toEqual(raw)
  })

  it('env 를 그대로 보존해 직렬화한다 (handoff 0028 — ~/.claude 덮어쓰기, env↛argv 분리 폐기)', () => {
    const raw = { env: { ANTHROPIC_API_KEY: 'plain-key' }, model: 'm' }
    const out = adaptSettings(raw) as { settings: string }
    expect(JSON.parse(out.settings)).toEqual(raw)
  })
})

describe('adaptEnv', () => {
  it('base 가 없거나 비면 옵션 생략 (SDK 기본 env 상속)', () => {
    expect(adaptEnv(undefined)).toEqual({})
    expect(adaptEnv({})).toEqual({})
  })

  it('base(시스템/턴 env)가 있으면 options.env 로 그대로 넘긴다', () => {
    expect(adaptEnv({ PATH: '/bin', A: 'a' })).toEqual({ env: { PATH: '/bin', A: 'a' } })
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
  const protectEnv: NormalizedHookHandler = (ctx) => {
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
