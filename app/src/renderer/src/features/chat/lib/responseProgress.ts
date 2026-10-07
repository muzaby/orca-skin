import type { ChatState } from '../reducer/chatReducer'

type ResponseState = Pick<
  ChatState,
  'inflight' | 'pendingAsks' | 'pendingPlanReview' | 'pendingToolApprovals'
>

export function isGeneratingResponse(state: ResponseState): boolean {
  return (
    state.inflight &&
    state.pendingAsks.length === 0 &&
    state.pendingPlanReview === null &&
    state.pendingToolApprovals.length === 0
  )
}

export function generatingSessionKeys(
  sessions: Readonly<Record<string, { session: ResponseState }>>
): string[] {
  return Object.keys(sessions)
    .filter((key) => isGeneratingResponse(sessions[key].session))
    .sort()
}

export function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
}
