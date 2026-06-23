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

  it('답변 키가 질문텍스트와 어긋나면 같은 인덱스 값으로 폴백', () => {
    // input.questions 의 question 텍스트와 answers 키가 불일치(정규화 경로 차이)해도
    // 위치(인덱스) 폴백으로 답을 잡는다.
    const { items } = parseAsk(
      call({
        questions: [
          { header: '언어', question: '주로 어떤 언어?' },
          { header: '종류', question: '어떤 종류?' }
        ],
        answers: {
          '주로 어떤 언어를 쓰나요?': ['Python', 'Go'],
          '어떤 종류의 프로젝트?': '내가입력'
        }
      })
    )
    expect(items).toEqual([
      { header: '언어', question: '주로 어떤 언어?', answer: 'Python, Go' },
      { header: '종류', question: '어떤 종류?', answer: '내가입력' }
    ])
  })

  it('input.questions 가 비어도 answers 엔트리로 items 구성', () => {
    const { items } = parseAsk(call({}, { answers: { 질문1: '기타직접', 질문2: ['A', 'B'] } }))
    expect(items).toEqual([
      { header: '', question: '질문1', answer: '기타직접' },
      { header: '', question: '질문2', answer: 'A, B' }
    ])
  })
})
