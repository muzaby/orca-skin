import { memo } from 'react'
import { UserMessage } from './UserMessage'
import { MessageMeta } from './MessageMeta'
import { turnCopyText, turnEquals, type Turn } from '../../lib/turns'

// 사용자 턴 — 보통 메시지 1개. 복사/시간 메타는 턴 끝에 한 번만.
// memo(turnEquals): 스트리밍 델타 프레임마다 transcript 전체가 재렌더되지 않도록
// 내용이 같은 턴은 건너뛴다 (0007-transcript-render-memo).
export const UserTurn = memo(
  function UserTurn({ turn }: { turn: Turn }): React.JSX.Element {
    const last = turn.messages[turn.messages.length - 1]
    return (
      <div className="group/msg flex flex-col gap-[var(--chat-item-gap)]" data-app-user-turn>
        {turn.messages.map((m, i) => (
          <UserMessage key={i} message={m} />
        ))}
        <MessageMeta text={turnCopyText(turn)} createdAt={last.createdAt} align="right" />
      </div>
    )
  },
  (prev, next) => turnEquals(prev.turn, next.turn)
)
