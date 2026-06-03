import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

interface AskQuestionLike {
  question?: unknown
  header?: unknown
  options?: unknown
}

// 답변값을 표시 문자열로 (단일 label / 다중 label[] / 자유입력).
function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join(', ')
  if (typeof value === 'string') return value
  return ''
}

// AskUserQuestion 본문 — 질문(좌, 어시스턴트)·답변(우, 사용자 버블)을 실제 대화처럼 렌더.
// 답변 출처: input.answers(질문 텍스트 키잉, updatedInput) → 없으면 result.output 폴백.
export function AskBody({ call }: { call: ToolCall }): React.JSX.Element {
  const rec =
    typeof call.input === 'object' && call.input !== null
      ? (call.input as Record<string, unknown>)
      : null
  const questions: AskQuestionLike[] = Array.isArray(rec?.questions)
    ? (rec!.questions as AskQuestionLike[])
    : []

  // answers: input.answers 우선, 없으면 result.output 가 객체면 사용.
  const answers: Record<string, unknown> =
    rec && typeof rec.answers === 'object' && rec.answers !== null
      ? (rec.answers as Record<string, unknown>)
      : typeof call.result?.output === 'object' && call.result?.output !== null
        ? (call.result.output as Record<string, unknown>)
        : {}
  const response = typeof rec?.response === 'string' ? rec.response : null

  if (questions.length === 0) {
    return (
      <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-ink">
        {stringify(call.input)}
      </pre>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => {
        const questionText = typeof q.question === 'string' ? q.question : ''
        const headerText = typeof q.header === 'string' ? q.header : ''
        const ans = answerText(answers[questionText])
        return (
          <div key={i} className="flex flex-col gap-1.5">
            {/* 질문 — 어시스턴트(좌) */}
            <div className="text-[13px] leading-[1.6] text-ink">
              {headerText && <span className="mr-1 text-ink3">{headerText} ·</span>}
              {questionText}
            </div>
            {/* 답변 — 사용자(우) */}
            {ans && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-bubble-user px-3 py-1.5 text-[13px] text-ink">
                  {ans}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {response && (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl bg-bubble-user px-3 py-1.5 text-[13px] text-ink">
            {response}
          </div>
        </div>
      )}
    </div>
  )
}
