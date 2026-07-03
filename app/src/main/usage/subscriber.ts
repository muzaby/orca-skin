// 사용량 집계 구독자(아키텍처 스펙 §4.2·§5.2) — turn.event 버스의 telemetry 를 소비해 사용량
// 부모/자식 행을 turn_usage 원장에 적재하고 비용 요약을 재계산·방출한다. 0062 이전엔 TurnPersistence
// (history) 안에 있었으나, "컨텍스트+비용 추적"은 history 영속과 별개 소비자이므로 버스 구독으로 분리.
//
// **순서 계약(critical)**: history 영속이 `turn.currentAssistantMessageId` 를 reset 하기 *전* 에
// 실행되어야 usage 행이 그 messageId 에 링크된다. bootstrap 의 버스 등록 순서(usage→history)가 이를
// 보장하며, 두 구독자 모두 critical(throw=턴 실패 전파)이다.

import type { NormalizedEvent } from '../../shared/ipc'
import type { DbQueries } from '../infra/db'
import type { CostTracker } from '../cost/tracker'
import type { TurnContext } from '../lifecycle/turn-context'
import { hasContextTokens } from './usageMap'

// usage 없거나 컨텍스트 0(/context 등 로컬 슬래시 명령 — 모델 미호출)이면 스킵한다 — 빈 행이 최신
// 행으로 컨텍스트 도넛을 0 으로 덮지 않게.
export function recordTurnUsage(
  db: DbQueries,
  cost: CostTracker,
  turn: TurnContext,
  ev: Extract<NormalizedEvent, { type: 'telemetry' }>
): void {
  const u = ev.usage
  if (!turn.dbSessionId || !u || !hasContextTokens(u)) return
  const now = Date.now()
  const turnUsageId = db.insertTurnUsage({
    sessionId: turn.dbSessionId,
    messageId: turn.currentAssistantMessageId,
    createdAt: now,
    inputTokens: u.inputTokens ?? null,
    outputTokens: u.outputTokens ?? null,
    cacheCreationInputTokens: u.cacheCreationTokens ?? null,
    cacheReadInputTokens: u.cacheReadTokens ?? null,
    totalCostUsd: u.costUsd ?? null
  })
  const modelEntries = Object.entries(u.modelUsage ?? {})
  if (modelEntries.length > 0) {
    for (const [model, mu] of modelEntries) {
      db.insertTurnModelUsage({
        turnUsageId,
        model,
        inputTokens: mu.inputTokens ?? null,
        outputTokens: mu.outputTokens ?? null,
        cacheCreationInputTokens: mu.cacheCreationTokens ?? null,
        cacheReadInputTokens: mu.cacheReadTokens ?? null,
        costUsd: mu.costUsd ?? null
      })
    }
  } else if (u.model) {
    db.insertTurnModelUsage({
      turnUsageId,
      model: u.model,
      inputTokens: u.inputTokens ?? null,
      outputTokens: u.outputTokens ?? null,
      cacheCreationInputTokens: u.cacheCreationTokens ?? null,
      cacheReadInputTokens: u.cacheReadTokens ?? null,
      costUsd: u.costUsd ?? null
    })
  }
  cost.recordAndBroadcast()
}
