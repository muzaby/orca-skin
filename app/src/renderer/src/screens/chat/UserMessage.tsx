import { MessageMeta } from './MessageMeta'
import type { Message } from '../../state/chatReducer'

interface UserMessageProps {
  message: Message
}

export function UserMessage({ message }: UserMessageProps): React.JSX.Element {
  return (
    <div className="group flex flex-col items-end">
      <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink">
        {message.content}
      </div>
      <MessageMeta text={message.content} createdAt={message.createdAt} align="right" />
    </div>
  )
}
