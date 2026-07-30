import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  makeClaudeHookCallback,
  makeSteerGateHook,
  mergeHooks,
  adaptEnv,
  adaptHooks,
  adaptPlugins,
  adaptSettings,
  adaptSettingSources,
  adaptSkills,
  adaptSystemPrompt,
  toClaudeHookOutput,
  toContext,
  extractCompactSummary,
  withPostCompactHook
} from './claude-adapt'
import type { NormalizedHookHandler } from './hooks'
import type { SkillInfo } from '../../shared/ipc'

describe('adaptPlugins', () => {
  let pluginRoot: string

  beforeEach(() => {
    pluginRoot = mkdtempSync(join(tmpdir(), 'orca-plugin-'))
  })
  afterEach(() => {
    rmSync(pluginRoot, { recursive: true, force: true })
  })

  function seedManifest(dir: string): void {
    mkdirSync(join(dir, '.claude-plugin'), { recursive: true })
    writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), '{"name":"x"}', 'utf8')
  }

  it('plugin root 부재(미지정/빈 배열/빈 값) 시 옵션 생략', () => {
    expect(adaptPlugins(undefined)).toEqual({})
    expect(adaptPlugins([])).toEqual({})
    expect(adaptPlugins(['', undefined, null])).toEqual({})
  })

  it('매니페스트(.claude-plugin/plugin.json)가 없으면 해당 root 생략 (deploy 실패/미실행 방어)', () => {
    // 경로 문자열은 있으나 실제 플러그인 매니페스트가 없는 경우 — 존재하지 않는 local plugin
    // 경로를 SDK 에 넘기지 않는다(AC#5·엣지케이스#2). 전부 탈락이면 옵션 자체 생략.
    expect(adaptPlugins([pluginRoot])).toEqual({})
  })

  it('매니페스트가 존재하면 local plugin 옵션을 만든다', () => {
    seedManifest(pluginRoot)
    expect(adaptPlugins([pluginRoot])).toEqual({
      plugins: [{ type: 'local', path: pluginRoot }]
    })
  })

  it('복수 root(orca + user 래퍼, 0117) — 유효한 것만 순서 보존으로 담는다', () => {
    const orca = join(pluginRoot, 'orca')
    const wrapper = join(pluginRoot, 'claude')
    const broken = join(pluginRoot, 'no-manifest')
    seedManifest(orca)
    seedManifest(wrapper)
    mkdirSync(broken, { recursive: true })
    expect(adaptPlugins([orca, broken, wrapper])).toEqual({
      plugins: [
        { type: 'local', path: orca },
        { type: 'local', path: wrapper }
      ]
    })
  })
})

describe('adaptSettingSources (0117)', () => {
  it('user 를 배제한 project/local 을 항상 명시한다', () => {
    expect(adaptSettingSources()).toEqual({ settingSources: ['project', 'local'] })
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
  const skill = (name: string, sourceKind: 'orca' | 'adapter', enabled: boolean): SkillInfo => ({
    name,
    description: '',
    sourceId: sourceKind === 'orca' ? 'orca' : 'adapter:claude',
    sourceLabel: sourceKind === 'orca' ? 'Orca 스킬' : 'CLAUDE 스킬',
    sourceKind,
    isBuiltin: sourceKind === 'orca',
    enabled,
    canToggle: sourceKind === 'orca',
    canRemove: sourceKind === 'orca',
    skillPath: `/x/${name}/SKILL.md`,
    skillDir: `/x/${name}`
  })

  it('알려진 스킬이 없으면 skills:all 로 둔다(스캔 누락 보호)', () => {
    expect(adaptSkills([])).toEqual({ skills: 'all' })
  })

  it('활성 Orca + 모든 어댑터 스킬만 활성 목록으로 반환한다(비활성 Orca 제외, 어댑터는 claude: 네임스페이스 — 0117)', () => {
    const skills = [
      skill('a', 'orca', true),
      skill('b', 'orca', false),
      skill('native', 'adapter', true)
    ]
    expect(adaptSkills(skills)).toEqual({ skills: ['orca:a', 'claude:native'] })
  })

  it('이미 네임스페이스된 Orca 스킬은 중복 prefix 하지 않는다', () => {
    expect(adaptSkills([skill('orca:ready', 'orca', true)])).toEqual({ skills: ['orca:ready'] })
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

describe('makeSteerGateHook (0060 D3·D4 — PostToolBatch 게이트 flush)', () => {
  type GateCallback = (
    input: never,
    toolUseID: undefined,
    options: { signal: AbortSignal }
  ) => Promise<unknown>

  function gateCallbackOf(fragment: object): GateCallback {
    const matchers = (fragment as { hooks: { PostToolBatch: Array<{ hooks: GateCallback[] }> } })
      .hooks.PostToolBatch
    expect(matchers).toHaveLength(1)
    return matchers[0].hooks[0]
  }

  const mainInput = { hook_event_name: 'PostToolBatch', session_id: 's', cwd: '/x' }
  const batch = { uuid: 'batch-1', ids: ['a', 'b'], text: 'first\n\nsecond', createdAt: 1 }

  it('메인 루프(agent_id 부재)에서 배치를 push 하고 {} 를 반환한다', async () => {
    const take = vi.fn(() => batch)
    const push = vi.fn(() => true)
    const cb = gateCallbackOf(makeSteerGateHook(take, push))
    expect(
      await cb(mainInput as never, undefined, { signal: new AbortController().signal })
    ).toEqual({})
    // 구조 페이로드(0067) — content 조립은 호출자(claude.ts) 몫이라 배치 그대로 넘긴다.
    expect(push).toHaveBeenCalledWith(batch)
  })

  it('서브에이전트 발화(agent_id 존재)에서는 take/push 를 호출하지 않는다', async () => {
    const take = vi.fn(() => batch)
    const push = vi.fn(() => true)
    const cb = gateCallbackOf(makeSteerGateHook(take, push))
    const input = { ...mainInput, agent_id: 'sub-1' }
    expect(await cb(input as never, undefined, { signal: new AbortController().signal })).toEqual(
      {}
    )
    expect(take).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('빈 큐(take → undefined)면 push 없이 {} (no-op 경계)', async () => {
    const push = vi.fn(() => true)
    const cb = gateCallbackOf(makeSteerGateHook(() => undefined, push))
    expect(
      await cb(mainInput as never, undefined, { signal: new AbortController().signal })
    ).toEqual({})
    expect(push).not.toHaveBeenCalled()
  })

  it('take/push 예외는 삼키고 {} 를 반환한다 (fail-open — 턴 본체 보호)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const throwingTake = gateCallbackOf(
        makeSteerGateHook(
          () => {
            throw new Error('boom')
          },
          vi.fn(() => true)
        )
      )
      expect(
        await throwingTake(mainInput as never, undefined, { signal: new AbortController().signal })
      ).toEqual({})
      const throwingPush = gateCallbackOf(
        makeSteerGateHook(
          () => batch,
          () => {
            throw new Error('closed')
          }
        )
      )
      expect(
        await throwingPush(mainInput as never, undefined, { signal: new AbortController().signal })
      ).toEqual({})
    } finally {
      warn.mockRestore()
    }
  })

  // ── 0151 AC4: 2단계 인계 — push 거부/예외 시 예약 롤백 ────────────────────────
  it('push 가 false(closed stream)면 rollback 을 호출한다 — 조용한 유실 없음', async () => {
    const rollback = vi.fn()
    const cb = gateCallbackOf(
      makeSteerGateHook(
        () => batch,
        () => false,
        rollback
      )
    )
    expect(
      await cb(mainInput as never, undefined, { signal: new AbortController().signal })
    ).toEqual({})
    expect(rollback).toHaveBeenCalledWith(batch)
  })

  it('push 성공(true)이면 rollback 하지 않는다', async () => {
    const rollback = vi.fn()
    const cb = gateCallbackOf(
      makeSteerGateHook(
        () => batch,
        () => true,
        rollback
      )
    )
    await cb(mainInput as never, undefined, { signal: new AbortController().signal })
    expect(rollback).not.toHaveBeenCalled()
  })

  it('push 예외도 롤백한다 — fail-open 이 상태 유실을 뜻하지는 않는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const rollback = vi.fn()
      const cb = gateCallbackOf(
        makeSteerGateHook(
          () => batch,
          () => {
            throw new Error('closed')
          },
          rollback
        )
      )
      expect(
        await cb(mainInput as never, undefined, { signal: new AbortController().signal })
      ).toEqual({})
      expect(rollback).toHaveBeenCalledWith(batch)
    } finally {
      warn.mockRestore()
    }
  })

  it('take 자체가 던지면 예약이 없으므로 rollback 하지 않는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const rollback = vi.fn()
      const cb = gateCallbackOf(
        makeSteerGateHook(
          () => {
            throw new Error('boom')
          },
          () => true,
          rollback
        )
      )
      await cb(mainInput as never, undefined, { signal: new AbortController().signal })
      expect(rollback).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('rollback 미주입(구 계약)이어도 push 거부가 턴을 깨지 않는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const cb = gateCallbackOf(
        makeSteerGateHook(
          () => batch,
          () => false
        )
      )
      expect(
        await cb(mainInput as never, undefined, { signal: new AbortController().signal })
      ).toEqual({})
    } finally {
      warn.mockRestore()
    }
  })
})

describe('mergeHooks', () => {
  const matcher = (): { hooks: unknown[] } => ({ hooks: [async () => ({})] })

  it('hooks 조각이 하나도 없으면 {} (옵션 미주입 보존)', () => {
    expect(mergeHooks({}, {})).toEqual({})
  })

  it('단일 조각은 그대로 통과한다', () => {
    const a = { hooks: { PreToolUse: [matcher()] } }
    expect(mergeHooks(a, {})).toEqual({ hooks: { PreToolUse: a.hooks.PreToolUse } })
  })

  it('서로 다른 이벤트는 보존, 같은 이벤트는 매처 배열 concat', () => {
    const pre = matcher()
    const batch1 = matcher()
    const batch2 = matcher()
    const merged = mergeHooks(
      { hooks: { PreToolUse: [pre], PostToolBatch: [batch1] } },
      { hooks: { PostToolBatch: [batch2] } }
    ) as { hooks: Record<string, unknown[]> }
    expect(merged.hooks.PreToolUse).toEqual([pre])
    expect(merged.hooks.PostToolBatch).toEqual([batch1, batch2])
  })
})

describe('withPostCompactHook (0064 r3)', () => {
  const invoke = async (
    onSummary: (s: string) => void,
    input: Record<string, unknown>,
    base: object = {}
  ): Promise<void> => {
    const { hooks } = withPostCompactHook(base, onSummary)
    const matchers = hooks.PostCompact!
    const cb = matchers[matchers.length - 1]!.hooks[0]!
    await cb(input as never, undefined, { signal: new AbortController().signal })
  }

  it('manual 압축의 compact_summary 를 onSummary 로 전달한다', async () => {
    const seen: string[] = []
    await invoke((s) => seen.push(s), {
      hook_event_name: 'PostCompact',
      trigger: 'manual',
      compact_summary: '① 배경… ② 목표…'
    })
    expect(seen).toEqual(['① 배경… ② 목표…'])
  })

  it('auto 압축·빈 요약은 무시한다 (일반 턴 transcript 비오염)', async () => {
    const seen: string[] = []
    await invoke((s) => seen.push(s), { trigger: 'auto', compact_summary: '요약' })
    await invoke((s) => seen.push(s), { trigger: 'manual', compact_summary: '   ' })
    await invoke((s) => seen.push(s), { trigger: 'manual' })
    expect(seen).toEqual([])
  })

  it('<analysis>/<summary> 원문에서 summary 내용만 승격한다 (r4 피드백 3)', async () => {
    const seen: string[] = []
    await invoke((s) => seen.push(s), {
      hook_event_name: 'PostCompact',
      trigger: 'manual',
      compact_summary:
        '<analysis>\n생각 과정…\n</analysis>\n<summary>\n1. 배경: …\n2. 목표: …\n</summary>'
    })
    expect(seen).toEqual(['1. 배경: …\n2. 목표: …'])
  })

  it('사용자 hooks 조각을 보존한 채 PostCompact 를 병합한다', () => {
    const userMatcher = { hooks: [] }
    const merged = withPostCompactHook(
      { hooks: { PreToolUse: [userMatcher], PostCompact: [userMatcher] } },
      () => undefined
    )
    expect(merged.hooks.PreToolUse).toEqual([userMatcher])
    expect(merged.hooks.PostCompact).toHaveLength(2)
    expect(merged.hooks.PostCompact![0]).toBe(userMatcher)
  })
})

describe('extractCompactSummary (0064 r4)', () => {
  it('summary 태그 내용만 추출한다', () => {
    expect(extractCompactSummary('<analysis>사고</analysis>\n<summary>요약 본문</summary>')).toBe(
      '요약 본문'
    )
  })

  it('summary 태그가 없으면 analysis 블럭·잔여 태그를 제거한 본문으로 폴백한다', () => {
    expect(extractCompactSummary('<analysis>사고</analysis>\n남은 본문')).toBe('남은 본문')
    expect(extractCompactSummary('태그 없는 요약')).toBe('태그 없는 요약')
  })

  it('summary 내용이 여러 줄이어도 앞뒤 공백만 정리한다', () => {
    expect(extractCompactSummary('<summary>\n1. A\n\n2. B\n</summary>')).toBe('1. A\n\n2. B')
  })
})
