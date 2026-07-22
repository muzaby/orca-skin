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
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
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
