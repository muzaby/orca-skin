import type { ActiveTurnRef } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'

export function activeTurnRef(
  turn: Pick<TurnContext<unknown>, 'isNewSession' | 'dbSessionId' | 'queueKey'>
): ActiveTurnRef {
  return {
    sessionId: turn.dbSessionId,
    clientKey: turn.isNewSession ? (turn.queueKey ?? null) : null
  }
}
