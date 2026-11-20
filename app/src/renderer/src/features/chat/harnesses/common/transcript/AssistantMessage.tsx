import { useTranscriptRuntime } from './TranscriptRuntime'
import { memo, useState } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { createSegmentCache } from '../../../lib/segmentCache'
import type { Message } from '../../../reducer/chatReducer'
import type { AgentTranscriptPresentation } from '../../../lib/agentPresentation'

interface AssistantMessageProps {
  message: Message
  transcriptPolicy: AgentTranscriptPresentation
}

// 본문 전용 — 메타(복사/시간)는 턴 단위로 AssistantTurn 이 한 번만 렌더한다.
// parts 를 콘텐츠 순서 보존 세그먼트(messageSegments)로 투영해 만나는 순서대로 렌더한다 →
// "텍스트 → 도구 → 텍스트" 가 모델이 말한 그대로 분절 표시된다(타입별 뭉치기 아님).
// sub-agent(Task/Agent)는 별도 처리 없이 tools 세그먼트의 일반 도구 카드로 순서 안에 끼어 렌더된다.
//
// 변경된 part부터 읽고, 이전 세그먼트와 도구 카드의 참조를 유지한다.
export const AssistantMessage = memo(function AssistantMessage({
  message,
  transcriptPolicy
}: AssistantMessageProps): React.JSX.Element {
  const { tr } = useI18n()
  const { Segment, messageClassName } = useTranscriptRuntime()
  const [cache] = useState(createSegmentCache)
  const segments = cache.segmentsFor(message)
  return (
    <div
      className={`flex flex-col ${messageClassName} text-[calc(14px*var(--transcript-text-scale,1))]`}
    >
      {segments.map((segment, index) => (
        <Segment key={index} segment={segment} transcriptPolicy={transcriptPolicy} />
      ))}
      {message.incomplete && (
        <div className="inline-flex w-fit rounded-full border border-border bg-bg2 px-2 py-1 text-[calc(0.75rem*var(--transcript-text-scale,1))] leading-none text-ink3">
          {tr('chat.transcript.incompleteResponse')}
        </div>
      )}
    </div>
  )
})
