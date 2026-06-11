import { memo } from 'react'
import { Markdown } from '../markdown/Markdown'
import { ToolGroup } from './ToolGroup'
import { AskExchange } from './AskExchange'
import { ReasoningBlock } from './ReasoningBlock'
import { ErrorCard } from './ErrorCard'
import { StructuredOutputCard } from './StructuredOutputCard'
import { messageSegments } from '../../lib/parts'
import type { Message } from '../../reducer/chatReducer'

interface AssistantMessageProps {
  message: Message
}

// 본문 전용 — 메타(복사/시간)는 턴 단위로 AssistantTurn 이 한 번만 렌더한다.
// parts 를 콘텐츠 순서 보존 세그먼트(messageSegments)로 투영해 만나는 순서대로 렌더한다 →
// "텍스트 → 도구 → 텍스트" 가 모델이 말한 그대로 분절 표시된다(타입별 뭉치기 아님).
// sub-agent(Task/Agent)는 별도 처리 없이 tools 세그먼트의 일반 도구 카드로 순서 안에 끼어 렌더된다.
// memo: reducer 가 마지막 메시지만 새 객체로 교체하므로(appendAssistantPart), 같은 턴 안에서도
// 변하지 않은 메시지는 identity 비교로 재렌더를 건너뛴다 (0007-transcript-render-memo).
export const AssistantMessage = memo(function AssistantMessage({
  message
}: AssistantMessageProps): React.JSX.Element {
  const segments = messageSegments(message.parts)
  return (
    <div className="flex flex-col gap-[var(--chat-item-gap)] text-[14px] leading-[1.7] text-ink">
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case 'reasoning':
            return <ReasoningBlock key={i} items={seg.items} />
          case 'tools':
            return <ToolGroup key={i} calls={seg.calls} />
          case 'ask':
            return <AskExchange key={i} call={seg.call} />
          case 'structured':
            return <StructuredOutputCard key={i} value={seg.value} />
          case 'text':
            return <Markdown key={i} source={seg.text} />
          case 'error':
            return <ErrorCard key={i} error={seg.error} />
        }
      })}
    </div>
  )
})
