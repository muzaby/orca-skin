import { isAskResolved, parseAsk } from '../../../lib/ask'
import type { ToolCall } from '../../../reducer/chatReducer'

export function OpenCodeAskExchange({ call }: { call: ToolCall }): React.JSX.Element | null {
  if (!isAskResolved(call)) return null
  const { items, response } = parseAsk(call)
  if (!items.length) return null
  return (
    <div
      data-component="opencode-question-answers"
      className="flex flex-col gap-[12px] py-[8px] text-[calc(13px*var(--transcript-text-scale,1))] leading-[20px]"
    >
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-[2px]">
          <div className="min-w-0 whitespace-pre-wrap break-words">
            <div className="text-oc-muted">{item.question}</div>
            {item.answer && <div className="mt-[2px] text-oc-ink">{item.answer}</div>}
          </div>
        </div>
      ))}
      {response && <div className="text-oc-ink">{response}</div>}
    </div>
  )
}
