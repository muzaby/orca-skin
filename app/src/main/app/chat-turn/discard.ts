// 세션 전체 중단(0151 r2 / OQ1 결정)의 본문. Composer [세션 전체 중단]과 Claude 플러그인 전역
// 토글(0283)이 함께 쓴다 — 호출자는 이벤트를 보낼 곳(요청 창 또는 전체 방송)만 고른다.
import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import { abortTurn } from '../../features/chat/abort'
import { getLogger } from '../../infra/log'

export interface DiscardSessionDeps {
  activity: {
    residualAttemptIds(sessionId: string): string[]
    setResidualAttempts(sessionId: string, attemptIds: readonly string[]): void
  }
  supervisor: {
    getBySession(sessionId: string): Pick<TurnContext, 'live' | 'controller'> | undefined
    discardRuntime(sessionId: string): boolean
  }
  pendingMessages: {
    discardSubmitted(sessionId: string, uuids: readonly string[]): Array<{ ids: string[] }>
  }
}

export function discardSessionWork(
  deps: DiscardSessionDeps,
  sessionId: string,
  emit: (event: NormalizedEvent) => void
): void {
  const residual = deps.activity.residualAttemptIds(sessionId)
  deps.activity.setResidualAttempts(sessionId, [])
  // 진행 중 턴이 남아 있으면 먼저 끊는다 — 그래야 런타임이 풀로 반납돼 폐기 대상이 된다.
  const turn = deps.supervisor.getBySession(sessionId)
  if (turn) abortTurn(turn, 'user_cancelled')
  deps.supervisor.discardRuntime(sessionId)
  // 큐 잔여를 되돌려준다 — 서브프로세스와 함께 CLI 큐가 사라졌으므로 이 예약들은 확실히
  // 실행되지 않는다. 텍스트는 draft 로 복원해 사용자가 재전송을 정한다.
  const discarded = deps.pendingMessages.discardSubmitted(sessionId, residual)
  const ids = discarded.flatMap((batch) => batch.ids)
  if (ids.length > 0) emit({ type: 'message.cancelled', sessionId, ids })
  getLogger().child('chat').info('chat.session.discarded', { sessionId, discarded: ids.length })
}
