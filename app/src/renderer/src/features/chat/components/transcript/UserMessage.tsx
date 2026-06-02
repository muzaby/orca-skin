import { MessageMeta } from './MessageMeta'
import type { Message } from '../../reducer/chatReducer'

interface UserMessageProps {
  message: Message
}

export function UserMessage({ message }: UserMessageProps): React.JSX.Element {
  return (
    <div className="group/msg flex w-full justify-end">
      <div className="flex min-w-0 max-w-[75%] flex-col items-end">
        <div className="relative flex max-w-full flex-col whitespace-pre-wrap text-pretty rounded-2xl bg-bubble-user px-4 py-3 text-[14px] leading-[1.7] text-ink [overflow-wrap:anywhere] select-text">
          {message.content}
        </div>
        <MessageMeta text={message.content} createdAt={message.createdAt} align="right" />
      </div>
    </div>
  )
}
