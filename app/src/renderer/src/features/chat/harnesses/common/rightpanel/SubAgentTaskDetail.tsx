import { useTranscriptRuntime } from '../transcript/TranscriptRuntime'
import { AssistantMessage } from '../transcript/AssistantMessage'
import { UserBubbleText } from '../transcript/UserBubbleText'
import { promptFromCall, type SubagentTaskSummary } from '../../../lib/parts'
import { useI18n } from '../../../../../shared/i18n'
import type { Message, ToolCall } from '../../../reducer/chatReducer'

// Task 결과 output 에서 완료 답변 텍스트를 끌어낸다 — 문자열이면 그대로, 객체면 summary/message.
function answerTextFromCall(call: ToolCall): string | null {
  const output = call.result?.output
  if (output == null) return null
  if (typeof output === 'string') return output.trim() !== '' ? output : null
  if (typeof output === 'object') {
    const rec = output as Record<string, unknown>
    if (Array.isArray(rec.content)) {
      const text = rec.content
        .flatMap((block) =>
          block && typeof block === 'object' && typeof block.text === 'string' ? [block.text] : []
        )
        .join('\n')
      if (text) return text
    }
    for (const key of ['summary', 'message', 'text']) {
      const v = rec[key]
      if (typeof v === 'string' && v.trim() !== '') return v
    }
  }
  return null
}

// 상세 — Task 프롬프트(요청사항)는 사용자 메시지 버블처럼 우측 정렬, 그 아래 child
// 트랜스크립트를 메인 transcript 컴포넌트로 렌더. 뒤로가기/제목은 타일 헤더가 담당.
// 간격은 메인 transcript 양식을 따른다 — 프롬프트↔답변 사이 --chat-turn-gap(턴 간격).
//
// **props 만 읽는 순수 View** — store 를 읽지 않아 `renderToStaticMarkup` 으로 검증할 수 있다.
export function SubAgentTaskDetail({
  task: selected,
  childMessage,
  startedAtMs,
  transcriptPolicy
}: {
  task: SubagentTaskSummary
  childMessage: Message | null
  startedAtMs: number | null
  transcriptPolicy: import('../../../lib/agentPresentation').AgentTranscriptPresentation
}): React.JSX.Element {
  const { tr } = useI18n()
  const { DetailStatus: StatusLine } = useTranscriptRuntime()
  const prompt = promptFromCall(selected.call)
  // child 트랜스크립트에 실제 답변 텍스트가 없으면(예: 도구 없이 끝난 Task) Task 결과의
  // summary/message 를 완료 답변으로 폴백 렌더한다(완료됨 답변 출력 보장).
  const childHasText = childMessage?.parts.some((p) => p.type === 'text') ?? false
  const answerFallback = childHasText ? null : answerTextFromCall(selected.call)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--chat-turn-gap)] overflow-auto px-p5 py-p4">
      {prompt && (
        <div className="flex justify-end">
          <UserBubbleText
            className="max-w-[85%] rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink"
            collapseKey={`subagent:${selected.toolUseId}`}
          >
            {prompt}
          </UserBubbleText>
        </div>
      )}
      {childMessage && (
        <AssistantMessage message={childMessage} transcriptPolicy={transcriptPolicy} />
      )}
      {answerFallback && (
        <div className="whitespace-pre-wrap text-[14px] leading-[1.7] text-ink">
          {answerFallback}
        </div>
      )}
      {/* 진행 중이면 메인 transcript 와 동일한 StatusLine 을 child 트랜스크립트 아래에 — 같은
            컴포넌트·인자(turnStartedAt)로 재사용해 "처리 중" 아이콘/경과를 동일하게 노출. */}
      {selected.status === 'running' && <StatusLine turnStartedAt={startedAtMs} />}
      {!childMessage && !answerFallback && (
        <div className="rounded-r5 border border-t5 bg-bg2 p-4 text-footnote text-ink3">
          {tr('chat.subagentTile.noChildActivity')}
        </div>
      )}
    </div>
  )
}
