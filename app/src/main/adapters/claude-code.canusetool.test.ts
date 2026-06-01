import { describe, it, expect, vi } from 'vitest'
import { makeCanUseTool } from './claude-code'
import type { AskQuestion, AskResult } from '../../shared/ipc'

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

describe('makeCanUseTool', () => {
  it('AskUserQuestion 이 아닌 도구는 allow passthrough (입력 보존)', async () => {
    const askUser = vi.fn<(q: AskQuestion[]) => Promise<AskResult>>()
    const canUse = makeCanUseTool(askUser)
    const input = { command: 'ls -la' }
    const res = await canUse('Bash', input, ctx)
    expect(res).toEqual({ behavior: 'allow', updatedInput: input })
    expect(askUser).not.toHaveBeenCalled()
  })

  it('AskUserQuestion answered → allow + questions echo + answers', async () => {
    const askUser = vi.fn<(q: AskQuestion[]) => Promise<AskResult>>().mockResolvedValue({
      type: 'answered',
      answers: { 'How should I format the output?': 'Summary' }
    })
    const canUse = makeCanUseTool(askUser)
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
    const canUse = makeCanUseTool(askUser)
    const res = await canUse('AskUserQuestion', { questions: QUESTIONS }, ctx)
    expect(res).toEqual({
      behavior: 'allow',
      updatedInput: { questions: QUESTIONS, answers: {}, response: '직접 진행해 주세요' }
    })
  })

  it('AskUserQuestion skipped → deny + 안내 메시지', async () => {
    const askUser = vi
      .fn<(q: AskQuestion[]) => Promise<AskResult>>()
      .mockResolvedValue({ type: 'skipped' })
    const canUse = makeCanUseTool(askUser)
    const res = await canUse('AskUserQuestion', { questions: QUESTIONS }, ctx)
    expect(res.behavior).toBe('deny')
    if (res.behavior === 'deny') expect(res.message).toMatch(/건너뛰/)
  })

  it('questions 누락 시 빈 배열로 위임', async () => {
    const askUser = vi
      .fn<(q: AskQuestion[]) => Promise<AskResult>>()
      .mockResolvedValue({ type: 'skipped' })
    const canUse = makeCanUseTool(askUser)
    await canUse('AskUserQuestion', {}, ctx)
    expect(askUser).toHaveBeenCalledWith([])
  })
})
