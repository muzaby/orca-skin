import { memo } from 'react'
import { parseAsk } from '../../lib/ask'
import type { ToolCall } from '../../reducer/chatReducer'

// AskUserQuestion 을 실제 대화처럼 트랜스크립트에 인라인 렌더 — 질문(어시스턴트 좌측),
// 답변(사용자 버블 우측). 요청됨 툴카드(ToolGroup)와 병존. 질문 0개면 렌더 안 함.
// memo(shallow): reconcileSegments 가 call identity 를 보존한다 (0008).
export const AskExchange = memo(function AskExchange({
  call
}: {
  call: ToolCall
}): React.JSX.Element | null {
  const { items, response } = parseAsk(call)
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          {/* 질문 — 어시스턴트(좌) */}
          <div className="text-[14px] leading-[1.7] text-ink">
            {item.header && <span className="mr-1 text-ink3">{item.header} ·</span>}
            {item.question}
          </div>
          {/* 답변 — 사용자(우) */}
          {item.answer && (
            <div className="flex justify-end">
              <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink">
                {item.answer}
              </div>
            </div>
          )}
        </div>
      ))}
      {response && (
        <div className="flex justify-end">
          <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink">
            {response}
          </div>
        </div>
      )}
    </div>
  )
})
