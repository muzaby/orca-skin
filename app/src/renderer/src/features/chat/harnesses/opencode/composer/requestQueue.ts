import type { ChatState } from '../../../reducer/chatReducer'

type RequestQueueState = Pick<
  ChatState,
  'pendingAsks' | 'pendingToolApprovals' | 'pendingRequestOrder'
>

export type OpenCodeRequest =
  | { kind: 'ask_question'; request: ChatState['pendingAsks'][number] }
  | { kind: 'tool_approval'; request: ChatState['pendingToolApprovals'][number] }

export function selectOpenCodeRequest(state: RequestQueueState): OpenCodeRequest | undefined {
  for (const entry of state.pendingRequestOrder) {
    if (entry.kind === 'ask_question') {
      const request = state.pendingAsks.find((ask) => ask.requestId === entry.requestId)
      if (request) return { kind: 'ask_question', request }
    } else {
      const request = state.pendingToolApprovals.find(
        (approval) => approval.approvalId === entry.requestId
      )
      if (request) return { kind: 'tool_approval', request }
    }
  }
  return undefined
}
