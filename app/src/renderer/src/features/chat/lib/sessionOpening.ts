export interface SessionOpeningState {
  inflight: boolean
  sessionId: string | null
  handoffFrom?: string | null
  userTurnCount: number
}

// 일반 새 턴은 런타임이 session id 를 발급할 때까지, 핸드오프는 id 승격 뒤에도 bootstrap
// compact 턴이 끝날 때까지 오픈 상태다. 핸드오프의 첫 user 메시지는 자동 합성 메시지다.
export function isSessionOpening({
  inflight,
  sessionId,
  handoffFrom,
  userTurnCount
}: SessionOpeningState): boolean {
  if (!inflight) return false
  if (handoffFrom != null && userTurnCount <= 1) return true
  return sessionId == null
}
