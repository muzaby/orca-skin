import { describe, it, expect, vi } from 'vitest'
import { makeCanUseTool } from './claude'
import type { AskQuestion, ApprovalResolution, PermissionAction } from '../../shared/ipc'

const ctx = { signal: new AbortController().signal } as never

type ReqApproval = (action: PermissionAction, signal?: AbortSignal) => Promise<ApprovalResolution>

const QUESTIONS: AskQuestion[] = [
  {
    question: 'How should I format the output?',
    header: 'Format',
    options: [
      { label: 'Summary', description: 'Brief' },
      { label: 'Detailed', description: 'Full' }
    ],
    multiSelect: false
  }
]

describe('makeCanUseTool — AskUserQuestion', () => {
  it('allow → questions echo + answers (updatedInput 에서 추출)', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({
      behavior: 'allow',
      updatedInput: { answers: { 'How should I format the output?': 'Summary' } }
    })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('AskUserQuestion', { questions: QUESTIONS }, ctx)
    expect(requestApproval).toHaveBeenCalledWith(
      {
        kind: 'ask_question',
        request: { requestId: '', questions: QUESTIONS }
      },
      expect.any(AbortSignal)
    )
    expect(res).toEqual({
      behavior: 'allow',
      updatedInput: {
        questions: QUESTIONS,
        answers: { 'How should I format the output?': 'Summary' }
      }
    })
  })

  it('allow + response 자유회신을 포함', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({
      behavior: 'allow',
      updatedInput: { answers: {}, response: '직접 진행해 주세요' }
    })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('AskUserQuestion', { questions: QUESTIONS }, ctx)
    expect(res).toEqual({
      behavior: 'allow',
      updatedInput: { questions: QUESTIONS, answers: {}, response: '직접 진행해 주세요' }
    })
  })

  it('deny → deny + 안내 메시지', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'deny' })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('AskUserQuestion', { questions: QUESTIONS }, ctx)
    expect(res?.behavior).toBe('deny')
    if (res?.behavior === 'deny') expect(res.message).toMatch(/건너뛰/)
  })

  it('questions 누락 시 빈 배열로 위임', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'deny' })
    const canUse = makeCanUseTool(requestApproval)
    await canUse('AskUserQuestion', {}, ctx)
    expect(requestApproval).toHaveBeenCalledWith(
      {
        kind: 'ask_question',
        request: { requestId: '', questions: [] }
      },
      expect.any(AbortSignal)
    )
  })

  it('requestApproval 미주입 시 AskUserQuestion 도 allow passthrough', async () => {
    const canUse = makeCanUseTool(undefined)
    const input = { questions: QUESTIONS }
    const res = await canUse('AskUserQuestion', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })
})

describe('makeCanUseTool — ExitPlanMode', () => {
  it('allow → allow + input echo (plan/allowedPrompts 보존)', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })
    const canUse = makeCanUseTool(requestApproval)
    const input = { plan: '# 계획\n- b.py 생성', allowedPrompts: [{ tool: 'Bash', prompt: 'run' }] }
    const res = await canUse('ExitPlanMode', input, ctx)
    expect(requestApproval).toHaveBeenCalledWith(
      {
        kind: 'plan_review',
        request: { requestId: '', plan: '# 계획\n- b.py 생성' }
      },
      expect.any(AbortSignal)
    )
    expect(res).toEqual({
      behavior: 'allow',
      updatedInput: input,
      updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }]
    })
  })

  it('allow 는 세션 스코프 setMode(acceptEdits) 를 동봉한다 — 계획 승인 = plan 모드 종료', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('ExitPlanMode', { plan: 'x' }, ctx)
    expect(res?.behavior).toBe('allow')
    if (res?.behavior !== 'allow') return
    // destination='session' 고정 — localSettings/projectSettings 는 settings 파일에 규칙을 쓴다.
    expect(res.updatedPermissions).toEqual([
      { type: 'setMode', mode: 'acceptEdits', destination: 'session' }
    ])
  })

  it('deny 는 권한 업데이트를 동봉하지 않는다 (모드 유지)', async () => {
    const requestApproval = vi
      .fn<ReqApproval>()
      .mockResolvedValue({ behavior: 'deny', message: '다시' })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('ExitPlanMode', { plan: 'x' }, ctx)
    expect(res).not.toHaveProperty('updatedPermissions')
  })

  it('deny + message → revise (피드백 메시지 동봉)', async () => {
    const requestApproval = vi
      .fn<ReqApproval>()
      .mockResolvedValue({ behavior: 'deny', message: '테스트도 추가해줘' })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('ExitPlanMode', { plan: 'x' }, ctx)
    expect(res?.behavior).toBe('deny')
    if (res?.behavior === 'deny') expect(res.message).toContain('테스트도 추가해줘')
  })

  it('deny (message 없음) → reject 중단 메시지', async () => {
    const requestApproval = vi
      .fn<ReqApproval>()
      .mockResolvedValue({ behavior: 'deny', interrupt: true })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('ExitPlanMode', { plan: 'x' }, ctx)
    expect(res?.behavior).toBe('deny')
    if (res?.behavior === 'deny') expect(res.message).toMatch(/거부|중단/)
  })

  it('plan 누락 시 빈 문자열로 위임', async () => {
    const requestApproval = vi
      .fn<ReqApproval>()
      .mockResolvedValue({ behavior: 'deny', interrupt: true })
    const canUse = makeCanUseTool(requestApproval)
    await canUse('ExitPlanMode', {}, ctx)
    expect(requestApproval).toHaveBeenCalledWith(
      {
        kind: 'plan_review',
        request: { requestId: '', plan: '' }
      },
      expect.any(AbortSignal)
    )
  })

  it('requestApproval 미주입 시 ExitPlanMode 도 allow passthrough (하위호환)', async () => {
    const canUse = makeCanUseTool(undefined)
    const input = { plan: 'x' }
    const res = await canUse('ExitPlanMode', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })
})

describe('makeCanUseTool — 위험 도구 게이트(tool_approval)', () => {
  it('위험 도구 + allow → allow (input 보존)', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })
    const canUse = makeCanUseTool(requestApproval)
    const input = { command: 'ls -la' }
    const res = await canUse('Bash', input, ctx)
    expect(requestApproval).toHaveBeenCalledWith(
      { kind: 'tool_approval', toolName: 'Bash', input },
      expect.any(AbortSignal)
    )
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })

  it('위험 도구 + allow + updatedInput → 갱신된 input 사용', async () => {
    const requestApproval = vi
      .fn<ReqApproval>()
      .mockResolvedValue({ behavior: 'allow', updatedInput: { command: 'ls' } })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('Bash', { command: 'ls -la' }, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: { command: 'ls' } })
  })

  it('위험 도구 + deny → deny + 기본 사유', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'deny' })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('Write', { file_path: '/tmp/x', content: 'y' }, ctx)
    expect(res?.behavior).toBe('deny')
    if (res?.behavior === 'deny') expect(res.message).toBeTruthy()
  })

  it('위험 도구 + deny + message → 사유 보존', async () => {
    const requestApproval = vi
      .fn<ReqApproval>()
      .mockResolvedValue({ behavior: 'deny', message: '그 파일은 건드리지 마' })
    const canUse = makeCanUseTool(requestApproval)
    const res = await canUse('Edit', { file_path: '/etc/hosts' }, ctx)
    expect(res?.behavior).toBe('deny')
    if (res?.behavior === 'deny') expect(res.message).toBe('그 파일은 건드리지 마')
  })

  it('안전 도구(Read)는 requestApproval 미호출 + 즉시 allow passthrough', async () => {
    const requestApproval = vi.fn<ReqApproval>()
    const canUse = makeCanUseTool(requestApproval)
    const input = { file_path: 'package.json' }
    const res = await canUse('Read', input, ctx)
    expect(requestApproval).not.toHaveBeenCalled()
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })

  it('requestApproval 미주입 시 위험 도구도 allow passthrough', async () => {
    const canUse = makeCanUseTool(undefined)
    const input = { command: 'rm -rf /' }
    const res = await canUse('Bash', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })
})

describe('makeCanUseTool — runtime MCP 도구 게이트(tool_approval)', () => {
  it('readOnlyHint가 true가 아닌 runtime 도구는 승인 요청으로 보낸다', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })
    const canUse = makeCanUseTool(requestApproval, {
      runtimeApprovalToolNames: new Set(['mcp__records__write'])
    })
    const input = { id: 'record-1', value: 'next' }

    const res = await canUse('mcp__records__write', input, ctx)

    expect(requestApproval).toHaveBeenCalledWith(
      { kind: 'tool_approval', toolName: 'mcp__records__write', input },
      expect.any(AbortSignal)
    )
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })

  it('readOnlyHint가 true인 runtime 도구는 승인 없이 passthrough한다', async () => {
    const requestApproval = vi.fn<ReqApproval>()
    const canUse = makeCanUseTool(requestApproval, {
      runtimeApprovalToolNames: new Set(['mcp__records__write'])
    })
    const input = { id: 'record-1' }

    expect(await canUse('mcp__records__read', input, ctx)).toEqual({
      behavior: 'allow',
      updatedInput: input
    })
    expect(requestApproval).not.toHaveBeenCalled()
  })

  it('requestApproval 미주입 시 runtime write 도구도 allow passthrough한다', async () => {
    const input = { id: 'record-1', value: 'next' }
    const canUse = makeCanUseTool(undefined, {
      runtimeApprovalToolNames: new Set(['mcp__records__write'])
    })

    expect(await canUse('mcp__records__write', input, ctx)).toEqual({
      behavior: 'allow',
      updatedInput: input
    })
  })
})

describe('makeCanUseTool — 서브에이전트 passthrough(0143) + 재호출 차단', () => {
  const reqAllow = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })

  it('Agent 호출은 run_in_background 무주입 passthrough (CLI 기본 = 백그라운드)', async () => {
    const canUse = makeCanUseTool(reqAllow)
    const input = { subagent_type: 'Explore', prompt: 'x' }
    const res = await canUse('Agent', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
    expect((res as { updatedInput?: Record<string, unknown> }).updatedInput).not.toHaveProperty(
      'run_in_background'
    )
  })

  it('구버전 도구명 Task 도 동일 passthrough', async () => {
    const canUse = makeCanUseTool(reqAllow)
    const input = { subagent_type: 'general' }
    const res = await canUse('Task', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })

  it('모델이 run_in_background:true 명시 → 보존', async () => {
    const canUse = makeCanUseTool(reqAllow)
    const input = { subagent_type: 'Explore', run_in_background: true }
    const res = await canUse('Agent', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })

  it('모델이 run_in_background:false 명시(동기 opt-out) → 보존', async () => {
    const canUse = makeCanUseTool(reqAllow)
    const input = { subagent_type: 'Explore', run_in_background: false }
    const res = await canUse('Agent', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })

  it('차단된 서브에이전트 타입은 deny(passthrough 보다 우선)', async () => {
    const canUse = makeCanUseTool(reqAllow, {
      isSubagentBlocked: (st) => st === 'Explore'
    })
    const res = await canUse('Agent', { subagent_type: 'Explore' }, ctx)
    expect(res?.behavior).toBe('deny')
    if (res?.behavior === 'deny') expect(res.message).toMatch(/취소|다시 호출/)
  })

  it('차단되지 않은 타입은 passthrough', async () => {
    const canUse = makeCanUseTool(reqAllow, {
      isSubagentBlocked: (st) => st === 'Explore'
    })
    const input = { subagent_type: 'other' }
    const res = await canUse('Agent', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })
})

// 0215 VP-01·VP-03 — 계획 본문의 출처가 주입 필드 하나가 아니다.
//
// SDK 0.3.220 의 `ExitPlanModeInput` 에는 `plan` 이 없다. CLI 가 계획 파일에서 읽어 주입하는데
// 그 파일은 모델이 써야만 존재한다 — custom 모델은 계획을 본문 텍스트로만 낸다.
describe('makeCanUseTool — ExitPlanMode 계획 본문 해소 (AT-01·AT-02)', () => {
  const planOf = (calls: unknown[][]): string =>
    (calls.at(-1)?.[0] as { request: { plan: string } }).request.plan

  it('AT-01 — plan 이 없으면 이번 턴 서술이 본문이 된다', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })
    const canUse = makeCanUseTool(requestApproval, {
      getPlanNarrative: () => '## 계획\n1. 파서를 고친다'
    })
    await canUse('ExitPlanMode', {}, ctx)
    expect(planOf(requestApproval.mock.calls)).toBe('## 계획\n1. 파서를 고친다')
  })

  it('AT-02 — 주입된 plan 이 서술을 이긴다', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })
    const canUse = makeCanUseTool(requestApproval, { getPlanNarrative: () => '서술' })
    await canUse('ExitPlanMode', { plan: '파일에서 온 계획' }, ctx)
    expect(planOf(requestApproval.mock.calls)).toBe('파일에서 온 계획')
  })

  it('AT-03 — 둘 다 없으면 빈 본문이고 승인 흐름은 그대로다', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })
    const canUse = makeCanUseTool(requestApproval, { getPlanNarrative: () => undefined })
    const res = await canUse('ExitPlanMode', {}, ctx)
    expect(planOf(requestApproval.mock.calls)).toBe('')
    expect(res?.behavior).toBe('allow')
  })

  it('VP-03 — provider 미주입이면 폴백이 없다 (배선이 사라지면 본문이 빈다)', async () => {
    const requestApproval = vi.fn<ReqApproval>().mockResolvedValue({ behavior: 'allow' })
    const canUse = makeCanUseTool(requestApproval)
    await canUse('ExitPlanMode', {}, ctx)
    expect(planOf(requestApproval.mock.calls)).toBe('')
  })
})
