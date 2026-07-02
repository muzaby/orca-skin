import { memo } from 'react'
import { AssistantMessage } from './AssistantMessage'
import { MessageMeta } from './MessageMeta'
import { YellowDot } from './YellowDot'
import { turnCopyText, turnEquals, type Turn } from '../../lib/turns'

interface AssistantTurnProps {
  turn: Turn
  // 이 턴이 아직 진행 중(스트리밍)이면 메타를 숨긴다 — "답변이 모두 종료됐을 때 하나의 턴".
  pending?: boolean
  // 분기(fork) 아이콘 노출 — transcript 의 마지막 assistant 턴에서만 true(0062 r2).
  forkable?: boolean
}

// 에이전트 턴 — 텍스트↔툴콜로 쪼개진 여러 assistant 메시지의 본문을 스택하고,
// 복사/시간 메타는 턴 끝에 한 번만(마지막 메시지 시각 + 합친 텍스트).
// `group/msg` (named) 로 hover 를 자기 턴에만 한정 — 익명 group 은 형제 턴까지
// 매칭돼 모든 메시지 메타가 동시에 노출되는 버그가 난다 (app/CLAUDE.md 그룹 스코프).
// memo(turnEquals ∧ pending): 스트리밍 중 변하지 않는 과거 턴의 재렌더(마크다운 재파싱
// 포함)를 차단한다 (0007-transcript-render-memo).
export const AssistantTurn = memo(
  function AssistantTurn({ turn, pending, forkable }: AssistantTurnProps): React.JSX.Element {
    const last = turn.messages[turn.messages.length - 1]
    // 도구를 실행한 agentic 턴이면 좌측 yellow dot 마커.
    const agentic = turn.messages.some((m) => m.parts.some((p) => p.type === 'tool_call'))
    return (
      <div className="group/msg relative flex flex-col gap-[var(--chat-item-gap)]">
        {agentic && (
          <span className="absolute left-[-21px] top-0">
            <YellowDot />
          </span>
        )}
        {turn.messages.map((m, i) => (
          <AssistantMessage key={i} message={m} />
        ))}
        {!pending && (
          <MessageMeta
            text={turnCopyText(turn)}
            createdAt={last.createdAt}
            align="left"
            forkable={forkable}
          />
        )}
      </div>
    )
  },
  (prev, next) =>
    prev.pending === next.pending &&
    prev.forkable === next.forkable &&
    turnEquals(prev.turn, next.turn)
)
