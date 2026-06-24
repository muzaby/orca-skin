import { memo } from 'react'
import { isAskResolved, parseAsk } from '../../lib/ask'
import type { ToolCall } from '../../reducer/chatReducer'

// AskUserQuestion 을 실제 대화처럼 트랜스크립트에 인라인 렌더 — 질문(어시스턴트 좌측),
// 답변(사용자 버블 우측). 요청됨 툴카드(ToolGroup)와 병존. 미응답(답변 선택 전)이거나
// 질문 0개면 렌더 안 함 — 답변 전에는 하단 Composer 의 AskUserQuestionCard 만 보인다.
// memo(shallow): reconcileSegments 가 call identity 를 보존한다 (0008).
export const AskExchange = memo(function AskExchange({
  call
}: {
  call: ToolCall
}): React.JSX.Element | null {
  if (!isAskResolved(call)) return null
  const { items, response } = parseAsk(call)
  if (items.length === 0) return null

  // 해소된 Q&A 를 하나의 어시스턴트 버블(좌)에 모은다 — 줄마다 "질문(중립) 답변(굵게)".
  // 질문은 어시스턴트가 물은 것이므로 좌측 정렬(사용자 답변 버블=우측과 구분).
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] flex-col gap-1 whitespace-pre-wrap rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink">
        {items.map((item, i) => (
          <div key={i}>
            <span className="text-ink2">{item.question}</span>
            {item.answer && <span className="font-semibold"> {item.answer}</span>}
          </div>
        ))}
        {response && <div className="font-semibold">{response}</div>}
      </div>
    </div>
  )
})
