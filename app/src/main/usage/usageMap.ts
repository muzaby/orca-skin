import type { ProviderReportedTelemetry } from '../../shared/ipc'
import type { UsageRow } from '../db/types'

// usage_events 의 한 행(세션 마지막 턴)을 컨텍스트 도넛/패널이 쓰는 ProviderReportedTelemetry 로
// 복원한다. 패널은 입력·캐시·모델만 표시하므로 durationMs/numTurns/modelUsage 는 생략.
// null 필드는 키 자체를 빼서 optional 의미를 유지(graceful).
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
