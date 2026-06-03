import { Markdown } from '../markdown/Markdown'
import { ToolGroup } from './ToolGroup'
import type { Message } from '../../reducer/chatReducer'

interface AssistantMessageProps {
  message: Message
}

// 본문 전용 — 메타(복사/시간)는 턴 단위로 AssistantTurn 이 한 번만 렌더한다.
export function AssistantMessage({ message }: AssistantMessageProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-[var(--chat-item-gap)] text-[14px] leading-[1.7] text-ink">
      {message.toolCalls && message.toolCalls.length > 0 && <ToolGroup calls={message.toolCalls} />}
      {message.content && <Markdown source={message.content} />}
    </div>
  )
}
