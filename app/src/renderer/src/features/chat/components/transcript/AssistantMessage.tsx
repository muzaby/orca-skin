import { Markdown } from '../markdown/Markdown'
import { ToolGroup } from './ToolGroup'
import { AskExchange } from './AskExchange'
import { ReasoningBlock } from './ReasoningBlock'
import { ErrorCard } from './ErrorCard'
import { StructuredOutputCard } from './StructuredOutputCard'
import {
  partsErrors,
  partsReasoning,
  partsStructured,
  partsText,
  partsToolCalls
} from '../../lib/parts'
import type { Message } from '../../reducer/chatReducer'

interface AssistantMessageProps {
  message: Message
}

// 본문 전용 — 메타(복사/시간)는 턴 단위로 AssistantTurn 이 한 번만 렌더한다.
// parts → reasoning 블록 + 도구 그룹(tool_call+tool_result 페어) + AskUserQuestion 인라인 대화
// + structured_output 카드 + error 카드 + 텍스트.
export function AssistantMessage({ message }: AssistantMessageProps): React.JSX.Element {
  const reasoning = partsReasoning(message.parts)
  const calls = partsToolCalls(message.parts)
  const asks = calls.filter((c) => c.name === 'AskUserQuestion')
  const structured = partsStructured(message.parts)
  const errors = partsErrors(message.parts)
  const text = partsText(message.parts)
  return (
    <div className="flex flex-col gap-[var(--chat-item-gap)] text-[14px] leading-[1.7] text-ink">
      {reasoning.length > 0 && <ReasoningBlock items={reasoning} />}
      {calls.length > 0 && <ToolGroup calls={calls} />}
      {asks.map((c) => (
        <AskExchange key={c.toolUseId} call={c} />
      ))}
      {structured.map((value, i) => (
        <StructuredOutputCard key={`so-${i}`} value={value} />
      ))}
      {text && <Markdown source={text} />}
      {errors.map((error, i) => (
        <ErrorCard key={`err-${i}`} error={error} />
      ))}
    </div>
  )
}
