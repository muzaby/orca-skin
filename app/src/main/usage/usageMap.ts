import type { ProviderReportedTelemetry } from '../../shared/ipc'
import type { UsageRow } from '../db/types'

// usage_events 의 한 행(세션 마지막 턴)을 컨텍스트 도넛/패널이 쓰는 ProviderReportedTelemetry 로
// 복원한다. 패널은 입력·캐시·모델만 표시하므로 durationMs/numTurns/modelUsage 는 생략.
// null 필드는 키 자체를 빼서 optional 의미를 유지(graceful).
// 컨텍스트 점유(input + cache_read + cache_creation)가 1 이상인지 — usage_events 적재 가드.
// /context 등 로컬 슬래시 명령은 모델을 호출하지 않아 컨텍스트도 비용도 없는 빈 행을 만든다.
// 이런 행을 적재하면 getLatestUsage 가 복원 시 직전 도넛 값을 0으로 덮어쓴다 → 적재 자체를 스킵.
export function hasContextTokens(usage: ProviderReportedTelemetry): boolean {
  return (
    (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0) > 0
  )
}

export function usageRowToTelemetry(row: UsageRow): ProviderReportedTelemetry {
  return {
    ...(row.model != null ? { model: row.model } : {}),
    ...(row.input_tokens != null ? { inputTokens: row.input_tokens } : {}),
    ...(row.output_tokens != null ? { outputTokens: row.output_tokens } : {}),
    ...(row.cache_read_tokens != null ? { cacheReadTokens: row.cache_read_tokens } : {}),
    ...(row.cache_creation_tokens != null
      ? { cacheCreationTokens: row.cache_creation_tokens }
      : {}),
    ...(row.cost_usd != null ? { costUsd: row.cost_usd } : {})
  }
}
