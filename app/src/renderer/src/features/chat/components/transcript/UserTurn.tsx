import { UserMessage } from './UserMessage'
import { MessageMeta } from './MessageMeta'
import { turnCopyText, type Turn } from '../../lib/turns'

// 사용자 턴 — 보통 메시지 1개. 복사/시간 메타는 턴 끝에 한 번만.
export function UserTurn({ turn }: { turn: Turn }): React.JSX.Element {
  const last = turn.messages[turn.messages.length - 1]
  return (
    <div className="group/msg flex flex-col gap-[var(--chat-item-gap)]" data-app-user-turn>
      {turn.messages.map((m, i) => (
        <UserMessage key={i} message={m} />
      ))}
      <MessageMeta text={turnCopyText(turn)} createdAt={last.createdAt} align="right" />
    </div>
  )
}
