import { ToolApprovalBody } from '../../../components/ApprovalCard'
import { chatActions } from '../../../store/chatStore'
import { OpenCodeQuestionDock } from './QuestionDock'
import type { OpenCodeRequest } from './requestQueue'

// Only the head is mounted. Pending requests remain in the session queues, outside the UI tree.
export function OpenCodeRequestDock({ request }: { request: OpenCodeRequest }): React.JSX.Element {
  const requestId =
    request.kind === 'ask_question' ? request.request.requestId : request.request.approvalId
  return (
    <div data-slot="composer-input-replacement" data-request-id={requestId}>
      {request.kind === 'ask_question' ? (
        <OpenCodeQuestionDock
          key={requestId}
          ask={request.request}
          onSubmit={(answers, response) => chatActions.answerAsk(requestId, answers, response)}
          onSkip={() => chatActions.skipAsk(requestId)}
        />
      ) : (
        <ToolApprovalBody key={requestId} {...request.request} />
      )}
    </div>
  )
}
