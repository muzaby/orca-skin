import { AssistantMessage } from './AssistantMessage'
import { MessageMeta } from './MessageMeta'
import { turnCopyText, type Turn } from '../../lib/turns'

interface AssistantTurnProps {
  turn: Turn
  // 이 턴이 아직 진행 중(스트리밍)이면 메타를 숨긴다 — "답변이 모두 종료됐을 때 하나의 턴".
  pending?: boolean
}

// 에이전트 턴 — 텍스트↔툴콜로 쪼개진 여러 assistant 메시지의 본문을 스택하고,
// 복사/시간 메타는 턴 끝에 한 번만(마지막 메시지 시각 + 합친 텍스트).
export function AssistantTurn({ turn, pending }: AssistantTurnProps): React.JSX.Element {
  const last = turn.messages[turn.messages.length - 1]
  return (
    <div className="group flex flex-col gap-[var(--chat-item-gap)]">
      {turn.messages.map((m, i) => (
        <AssistantMessage key={i} message={m} />
      ))}
      {!pending && (
        <MessageMeta text={turnCopyText(turn)} createdAt={last.createdAt} align="left" />
      )}
    </div>
  )
}
