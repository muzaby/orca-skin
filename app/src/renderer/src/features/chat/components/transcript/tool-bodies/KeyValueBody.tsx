import { Markdown } from '../../markdown/Markdown'
import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

// 미지정/검색류 도구의 기본 본문 — input 을 JSON 대신 `key: value` 줄바꿈 plain text 로,
// 결과는 문자열이면 Markdown, 아니면 plain. (예: `query: …` / `max_results: …`)
export function KeyValueBody({ call }: { call: ToolCall }): React.JSX.Element {
  const rec =
    typeof call.input === 'object' && call.input !== null
      ? (call.input as Record<string, unknown>)
      : null
  const entries = rec ? Object.entries(rec) : []
  const output = call.result?.output

  return (
    <div className="flex flex-col gap-2">
      {entries.length > 0 ? (
        <div className="whitespace-pre-wrap break-words text-ink">
          {entries.map(([k, v]) => (
            <div key={k}>
              <span className="text-ink3">{k}: </span>
              {typeof v === 'string' ? v : stringify(v)}
            </div>
          ))}
        </div>
      ) : (
        rec == null &&
        call.input != null && (
          <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-ink">
            {stringify(call.input)}
          </pre>
        )
      )}
      {call.result &&
        (typeof output === 'string' ? (
          output.trim() !== '' && (
            <div className="border-t border-border pt-2">
              <Markdown source={output} />
            </div>
          )
        ) : (
          <pre className="m-0 border-t border-border pt-2 overflow-auto whitespace-pre-wrap break-words text-ink">
            {stringify(output)}
          </pre>
        ))}
    </div>
  )
}
