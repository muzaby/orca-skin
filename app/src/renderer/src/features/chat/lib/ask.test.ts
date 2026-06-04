import { describe, it, expect } from 'vitest'
import { parseAsk } from './ask'
import type { ToolCall } from '../reducer/chatReducer'

const call = (input: unknown, output?: unknown): ToolCall => ({
  toolUseId: 'ask-1',
  name: 'AskUserQuestion',
  input,
  ...(output !== undefined ? { result: { output, isError: false } } : {})
})

describe('parseAsk', () => {
  it('input.answers(질문텍스트 키잉) 에서 단일/다중 답변 추출', () => {
    const { items, response } = parseAsk(
      call({
        questions: [
          { header: '배포', question: '어떻게 배포?' },
          { header: '환경', question: '어디에?' }
        ],
        answers: { '어떻게 배포?': 'Docker', '어디에?': ['AWS', 'GCP'] }
      })
    )
    expect(items).toEqual([
      { header: '배포', question: '어떻게 배포?', answer: 'Docker' },
      { header: '환경', question: '어디에?', answer: 'AWS, GCP' }
    ])
    expect(response).toBeNull()
  })

  it('input.answers 없으면 result.output.answers(router 주입) 사용', () => {
    const { items } = parseAsk(
      call({ questions: [{ header: 'h', question: 'Q?' }] }, { answers: { 'Q?': '답' } })
    )
    expect(items[0].answer).toBe('답')
  })

  it('response 는 input 또는 result.output 에서 추출', () => {
    expect(
      parseAsk(call({ questions: [{ header: 'h', question: 'Q?' }], response: '직접 회신' }))
        .response
    ).toBe('직접 회신')
    expect(
      parseAsk(
        call(
          { questions: [{ header: 'h', question: 'Q?' }] },
          { answers: {}, response: '출력회신' }
        )
      ).response
    ).toBe('출력회신')
  })

  it('questions 없으면 빈 items', () => {
    expect(parseAsk(call({})).items).toEqual([])
  })
})
