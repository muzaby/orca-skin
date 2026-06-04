import type { Message } from '../../reducer/chatReducer'

interface UserMessageProps {
  message: Message
}

// 본문 전용 — 메타(복사/시간)는 턴 단위로 UserTurn 이 한 번만 렌더한다.
export function UserMessage({ message }: UserMessageProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink">
        {message.content}
      </div>
    </div>
  )
}
