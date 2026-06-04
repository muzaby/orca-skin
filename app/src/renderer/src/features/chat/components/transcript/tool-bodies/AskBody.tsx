import type { ToolCall } from '../../../reducer/chatReducer'

// AskUserQuestion 카드 본문 — 입력(JSON 와이어)을 pretty 아닌 compact plain text 로 그대로 출력.
// (읽기 좋은 질문/답변 대화는 트랜스크립트의 AskExchange 가 담당.)
function compact(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function AskBody({ call }: { call: ToolCall }): React.JSX.Element {
  return (
    <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-ink">
      {compact(call.input)}
    </pre>
  )
}
