import { Markdown } from './markdown/Markdown'
import { ToolCard } from './ToolCard'
import { MessageMeta } from './MessageMeta'
import type { Message } from '../../state/chatReducer'

interface AssistantMessageProps {
  message: Message
}

export function AssistantMessage({ message }: AssistantMessageProps): React.JSX.Element {
  return (
    <div className="group flex flex-col">
      <div className="flex flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
        {message.toolCalls?.map((tc) => (
          <ToolCard key={tc.toolUseId} call={tc} />
        ))}
        {message.content && <Markdown source={message.content} />}
      </div>
      <MessageMeta text={message.content} createdAt={message.createdAt} align="left" />
    </div>
  )
}
