import { Markdown } from '../markdown/Markdown'
import { ToolGroup } from './ToolGroup'
import { MessageMeta } from './MessageMeta'
import type { Message } from '../../reducer/chatReducer'

interface AssistantMessageProps {
  message: Message
}

export function AssistantMessage({ message }: AssistantMessageProps): React.JSX.Element {
  return (
    <div className="group flex flex-col">
      <div className="flex flex-col gap-[var(--chat-item-gap)] text-[14px] leading-[1.7] text-ink">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolGroup calls={message.toolCalls} />
        )}
        {message.content && <Markdown source={message.content} />}
      </div>
      <MessageMeta text={message.content} createdAt={message.createdAt} align="left" />
    </div>
  )
}
