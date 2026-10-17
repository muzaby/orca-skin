import { AskUserQuestionCard } from './QuestionCard'
import { ToolApprovalBody } from './ToolApproval'
import { chatActions, useChatSession } from '../../../store/chatStore'
export function Requests(): React.JSX.Element {
  const ask = useChatSession((s) => s.pendingAsks[0])
  const approvals = useChatSession((s) => s.pendingToolApprovals)
  return (
    <>
      {ask && (
        <AskUserQuestionCard
          key={ask.requestId}
          ask={ask}
          onSubmit={(answers, response) => chatActions.answerAsk(ask.requestId, answers, response)}
          onSkip={() => chatActions.skipAsk(ask.requestId)}
        />
      )}{' '}
      {approvals.map((p) => (
        <ToolApprovalBody key={p.approvalId} {...p} />
      ))}
    </>
  )
}
