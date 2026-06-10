import type { ProviderReportedTelemetry, TelemetryModelUsage } from '../../shared/ipc'
import type { TurnModelUsageRow, TurnUsageRow } from '../db/types'

// 컨텍스트 점유(input + cache_read + cache_creation)가 1 이상인지 — turn_usage 적재 가드.
// /context 등 로컬 슬래시 명령은 모델을 호출하지 않아 컨텍스트도 비용도 없는 빈 행을 만든다.
// 이런 행을 적재하면 getLatestTurnUsage 가 복원 시 직전 도넛 값을 0으로 덮어쓴다 → 적재 자체를 스킵.
export function hasContextTokens(usage: ProviderReportedTelemetry): boolean {
  return (
    (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0) > 0
  )
}

export function usageRowToTelemetry(
  turn: TurnUsageRow,
  modelRows: TurnModelUsageRow[]
): ProviderReportedTelemetry {
  const modelUsage = modelRows.reduce<Record<string, TelemetryModelUsage>>((acc, row) => {
    acc[row.model] = {
      ...(row.input_tokens != null ? { inputTokens: row.input_tokens } : {}),
      ...(row.output_tokens != null ? { outputTokens: row.output_tokens } : {}),
      ...(row.cache_read_input_tokens != null
        ? { cacheReadTokens: row.cache_read_input_tokens }
        : {}),
      ...(row.cache_creation_input_tokens != null
        ? { cacheCreationTokens: row.cache_creation_input_tokens }
        : {}),
      ...(row.cost_usd != null ? { costUsd: row.cost_usd } : {})
    }
    return acc
  }, {})

  const primary = primaryModel(modelRows)
  return {
    ...(primary ? { model: primary } : {}),
    ...(turn.input_tokens != null ? { inputTokens: turn.input_tokens } : {}),
    ...(turn.output_tokens != null ? { outputTokens: turn.output_tokens } : {}),
    ...(turn.cache_read_input_tokens != null
      ? { cacheReadTokens: turn.cache_read_input_tokens }
      : {}),
    ...(turn.cache_creation_input_tokens != null
      ? { cacheCreationTokens: turn.cache_creation_input_tokens }
      : {}),
    ...(turn.total_cost_usd != null ? { costUsd: turn.total_cost_usd } : {}),
    ...(Object.keys(modelUsage).length > 0 ? { modelUsage } : {})
  }
}

function primaryModel(rows: TurnModelUsageRow[]): string | undefined {
  let best: TurnModelUsageRow | undefined
  for (const row of rows) {
    if (!best || (row.input_tokens ?? 0) > (best.input_tokens ?? 0)) best = row
  }
  return best?.model
}
