import { describe, it, expect, vi } from 'vitest'
import { makeCanUseTool } from './claude-code'
import type { AskQuestion, AskResult, PlanDecision } from '../../shared/ipc'

const ctx = { signal: new AbortController().signal } as never

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
  it('그 외 도구는 allow passthrough (입력 보존)', async () => {
    const askUser = vi.fn<(q: AskQuestion[]) => Promise<AskResult>>()
    const canUse = makeCanUseTool({ askUser })
    const input = { command: 'ls -la' }
    const res = await canUse('Bash', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
    expect(askUser).not.toHaveBeenCalled()
  })

  it('answered → allow + questions echo + answers', async () => {
    const askUser = vi.fn<(q: AskQuestion[]) => Promise<AskResult>>().mockResolvedValue({
      type: 'answered',
      answers: { 'How should I format the output?': 'Summary' }
    })
    const canUse = makeCanUseTool({ askUser })
    const res = await canUse('AskUserQuestion', { questions: QUESTIONS }, ctx)
    expect(askUser).toHaveBeenCalledWith(QUESTIONS)
    expect(res).toEqual({
      behavior: 'allow',
      updatedInput: {
        questions: QUESTIONS,
        answers: { 'How should I format the output?': 'Summary' }
      }
    })
  })

  it('answered + response 자유회신을 포함', async () => {
    const askUser = vi
      .fn<(q: AskQuestion[]) => Promise<AskResult>>()
      .mockResolvedValue({ type: 'answered', answers: {}, response: '직접 진행해 주세요' })
    const canUse = makeCanUseTool({ askUser })
    const res = await canUse('AskUserQuestion', { questions: QUESTIONS }, ctx)
    expect(res).toEqual({
      behavior: 'allow',
      updatedInput: { questions: QUESTIONS, answers: {}, response: '직접 진행해 주세요' }
    })
  })

  it('skipped → deny + 안내 메시지', async () => {
    const askUser = vi
      .fn<(q: AskQuestion[]) => Promise<AskResult>>()
      .mockResolvedValue({ type: 'skipped' })
    const canUse = makeCanUseTool({ askUser })
    const res = await canUse('AskUserQuestion', { questions: QUESTIONS }, ctx)
    expect(res.behavior).toBe('deny')
    if (res.behavior === 'deny') expect(res.message).toMatch(/건너뛰/)
  })

  it('questions 누락 시 빈 배열로 위임', async () => {
    const askUser = vi
      .fn<(q: AskQuestion[]) => Promise<AskResult>>()
      .mockResolvedValue({ type: 'skipped' })
    const canUse = makeCanUseTool({ askUser })
    await canUse('AskUserQuestion', {}, ctx)
    expect(askUser).toHaveBeenCalledWith([])
  })

  it('askUser 미주입 시 AskUserQuestion 도 allow passthrough', async () => {
    const canUse = makeCanUseTool({})
    const input = { questions: QUESTIONS }
    const res = await canUse('AskUserQuestion', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })
})

describe('makeCanUseTool — ExitPlanMode', () => {
  it('approved → allow + input echo (plan/allowedPrompts 보존)', async () => {
    const reviewPlan = vi
      .fn<(plan: string) => Promise<PlanDecision>>()
      .mockResolvedValue({ type: 'approved' })
    const canUse = makeCanUseTool({ reviewPlan })
    const input = { plan: '# 계획\n- b.py 생성', allowedPrompts: [{ tool: 'Bash', prompt: 'run' }] }
    const res = await canUse('ExitPlanMode', input, ctx)
    expect(reviewPlan).toHaveBeenCalledWith('# 계획\n- b.py 생성')
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })

  it('revise → deny + 피드백 메시지', async () => {
    const reviewPlan = vi
      .fn<(plan: string) => Promise<PlanDecision>>()
      .mockResolvedValue({ type: 'revise', feedback: '테스트도 추가해줘' })
    const canUse = makeCanUseTool({ reviewPlan })
    const res = await canUse('ExitPlanMode', { plan: 'x' }, ctx)
    expect(res.behavior).toBe('deny')
    if (res.behavior === 'deny') expect(res.message).toContain('테스트도 추가해줘')
  })

  it('rejected → deny + 중단 메시지', async () => {
    const reviewPlan = vi
      .fn<(plan: string) => Promise<PlanDecision>>()
      .mockResolvedValue({ type: 'rejected' })
    const canUse = makeCanUseTool({ reviewPlan })
    const res = await canUse('ExitPlanMode', { plan: 'x' }, ctx)
    expect(res.behavior).toBe('deny')
    if (res.behavior === 'deny') expect(res.message).toMatch(/거부|중단/)
  })

  it('plan 누락 시 빈 문자열로 위임', async () => {
    const reviewPlan = vi
      .fn<(plan: string) => Promise<PlanDecision>>()
      .mockResolvedValue({ type: 'rejected' })
    const canUse = makeCanUseTool({ reviewPlan })
    await canUse('ExitPlanMode', {}, ctx)
    expect(reviewPlan).toHaveBeenCalledWith('')
  })

  it('reviewPlan 미주입 시 ExitPlanMode 도 allow passthrough (하위호환)', async () => {
    const canUse = makeCanUseTool({})
    const input = { plan: 'x' }
    const res = await canUse('ExitPlanMode', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
  })
})
