import { memo, useRef } from 'react'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { ToolGroup } from './ToolGroup'
import { AskExchange } from './AskExchange'
import { ReasoningBlock } from './ReasoningBlock'
import { ErrorCard } from './ErrorCard'
import { StructuredOutputCard } from './StructuredOutputCard'
import { messageSegments, reconcileSegments, type MessageSegment } from '../../lib/parts'
import type { Message } from '../../reducer/chatReducer'

interface AssistantMessageProps {
  message: Message
}

// 본문 전용 — 메타(복사/시간)는 턴 단위로 AssistantTurn 이 한 번만 렌더한다.
// parts 를 콘텐츠 순서 보존 세그먼트(messageSegments)로 투영해 만나는 순서대로 렌더한다 →
// "텍스트 → 도구 → 텍스트" 가 모델이 말한 그대로 분절 표시된다(타입별 뭉치기 아님).
// sub-agent(Task/Agent)는 별도 처리 없이 tools 세그먼트의 일반 도구 카드로 순서 안에 끼어 렌더된다.
//
// 재렌더 격리 2단 (0007 → 0008):
//   · memo(message identity): reducer 가 마지막 메시지만 새 객체로 교체하므로 변하지 않은
//     메시지는 통째로 건너뛴다.
//   · reconcileSegments: 마지막 메시지가 교체돼 이 컴포넌트가 재실행돼도, 직전 렌더와
//     내용이 같은 세그먼트/ToolCall 의 identity 를 재사용한다 → memo 된 자식(ToolGroup·
//     ToolCard·ReasoningBlock·Markdown…)이 shallow 비교로 bail — tool.call.* 커밋 1건은
//     "변경된 카드 1개" 재렌더로 좁혀진다.
export const AssistantMessage = memo(function AssistantMessage({
  message
}: AssistantMessageProps): React.JSX.Element {
  const prevRef = useRef<MessageSegment[] | null>(null)
  const segments = reconcileSegments(prevRef.current, messageSegments(message.parts))
  prevRef.current = segments
  return (
    <div className="flex flex-col gap-[var(--chat-item-gap)] text-[14px] leading-[1.7] text-ink">
      {segments.map((seg, i) => {
        // 세그먼트는 append-only(연속 동종 병합) 라 index key 가 안정적이다.
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
      {message.incomplete && (
        <div className="inline-flex w-fit rounded-full border border-border bg-bg2 px-2 py-1 text-xs leading-none text-ink3">
          응답이 완료되지 않았습니다
        </div>
      )}
    </div>
  )
})
