import type { TurnRequest } from '../common/turn'
import type { LiveTurn, SessionAdapter } from '../common/types'

// 런타임의 cold spawn 순서(준비 → `sendMessage`)를 어댑터 단위 테스트에서 그대로 밟는다.
export async function sendPrepared(
  adapter: Pick<SessionAdapter, 'sendMessage' | 'prepareTurn'>,
  req: TurnRequest
): Promise<LiveTurn> {
  const prepared = await adapter.prepareTurn?.(req, req.signal ?? new AbortController().signal)
  const live = adapter.sendMessage(prepared === undefined ? req : { ...req, prepared })
  if (live.submitInitial) {
    try {
      const outcome = await live.submitInitial(req.signal)
      if (outcome.kind !== 'accepted') throw new Error(outcome.kind)
    } catch (error) {
      live.close()
      throw error
    }
  }
  return live
}
