// AskUserQuestion 질문/답변 추출 (순수). 트랜스크립트 인라인 대화(AskExchange)가 사용.
// 답변 출처: input.answers(updatedInput, 질문텍스트 키잉) 우선 → 없으면 result.output 가 객체면 사용.
// 백엔드 중립: 중립 ToolCall 만 입력.

import type { ToolCall } from '../reducer/chatReducer'

export interface AskItem {
  header: string
  question: string
  answer: string
}

export interface ParsedAsk {
  items: AskItem[]
  response: string | null
}

function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join(', ')
  if (typeof value === 'string') return value
  return ''
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
}

export function parseAsk(call: ToolCall): ParsedAsk {
  const rec = asRecord(call.input)
  const out = asRecord(call.result?.output)
  const rawQuestions = Array.isArray(rec?.questions) ? (rec!.questions as unknown[]) : []

  // answers: input.answers(드묾) → result.output.answers(router 가 주입) → {}.
  // (main 이 AskUserQuestion tool_result output 에 { answers, response? } 를 주입한다.)
  const answers: Record<string, unknown> = asRecord(rec?.answers) ?? asRecord(out?.answers) ?? {}

  const items: AskItem[] = rawQuestions.map((q) => {
    const qr = asRecord(q)
    const question = typeof qr?.question === 'string' ? qr.question : ''
    const header = typeof qr?.header === 'string' ? qr.header : ''
    return { header, question, answer: answerText(answers[question]) }
  })

  const response =
    (typeof rec?.response === 'string' ? rec.response : null) ??
    (typeof out?.response === 'string' ? out.response : null)
  return { items, response }
}
