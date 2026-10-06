// 표시 합성만 수행한다. 원격 일 칸·모델 집합은 SDK 값을 전부 대체한다.
import type { UsageStats } from '../../../shared/ipc'
import { totalTokens } from '../../../shared/usage/stats'
import type {
  ProviderDailyUsageRow,
  ProviderDayModelUsageRow,
  ProviderUsagePeriodRow,
  ProviderUsagePeriodModelRow
} from '../../infra/db/types'

type Day = UsageStats['days'][number]
type Model = UsageStats['models'][number]
const cell = (provider: string | null, day: string): string => JSON.stringify([provider, day])

export function composeUsageStats(
  localDays: readonly ProviderDailyUsageRow[],
  localModels: readonly ProviderDayModelUsageRow[],
  remoteDays: readonly ProviderUsagePeriodRow[],
  remoteModels: readonly ProviderUsagePeriodModelRow[],
  window: { from?: string; to: string }
): Pick<UsageStats, 'days' | 'models'> {
  const inRange = (day: string): boolean =>
    day <= window.to && (window.from == null || day >= window.from)
  const dayCells = new Map<string, Day>()
  for (const row of localDays) {
    if (inRange(row.day))
      dayCells.set(cell(row.provider_key, row.day), {
        day: row.day,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheCreationInputTokens: row.cache_creation_input_tokens,
        cacheReadInputTokens: row.cache_read_input_tokens,
        totalCostUsd: row.total_cost_usd
      })
  }
  for (const row of remoteDays) {
    if (row.period_kind === 'day' && inRange(row.period))
      dayCells.set(cell(row.provider_key, row.period), {
        day: row.period,
        inputTokens: row.input_tokens ?? 0,
        outputTokens: row.output_tokens ?? 0,
        cacheCreationInputTokens: row.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: row.cache_read_input_tokens ?? 0,
        totalCostUsd: row.cost_usd ?? 0
      })
  }
  const days = new Map<string, Day>()
  for (const row of dayCells.values()) {
    const acc = days.get(row.day) ?? {
      day: row.day,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalCostUsd: 0
    }
    addMetrics(acc, row)
    acc.totalCostUsd += row.totalCostUsd
    days.set(row.day, acc)
  }
  const modelCells = new Map<string, Model[]>()
  for (const row of localModels) {
    if (!inRange(row.day)) continue
    const key = cell(row.provider_key, row.day)
    const models = modelCells.get(key) ?? []
    models.push({
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      cacheCreationInputTokens: row.cache_creation_input_tokens,
      cacheReadInputTokens: row.cache_read_input_tokens,
      costUsd: row.cost_usd
    })
    modelCells.set(key, models)
  }
  const remoteModelCells = new Map<string, Model[]>()
  for (const row of remoteModels) {
    if (row.period_kind !== 'day' || !inRange(row.period)) continue
    const key = cell(row.provider_key, row.period)
    const models = remoteModelCells.get(key) ?? []
    models.push({
      model: row.model,
      inputTokens: row.input_tokens ?? 0,
      outputTokens: row.output_tokens ?? 0,
      cacheCreationInputTokens: row.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: row.cache_read_input_tokens ?? 0,
      costUsd: row.cost_usd ?? 0
    })
    remoteModelCells.set(key, models)
  }
  for (const [key, rows] of remoteModelCells) modelCells.set(key, rows)
  const models = new Map<string, Model>()
  for (const rows of modelCells.values())
    for (const row of rows) {
      const acc = models.get(row.model) ?? {
        model: row.model,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        costUsd: 0
      }
      addMetrics(acc, row)
      acc.costUsd += row.costUsd
      models.set(row.model, acc)
    }
  return {
    days: [...days.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)),
    models: [...models.values()].sort(
      (a, b) =>
        totalTokens(b) - totalTokens(a) || (a.model < b.model ? -1 : a.model > b.model ? 1 : 0)
    )
  }
}

function addMetrics(acc: Day | Model, row: Day | Model): void {
  acc.inputTokens += row.inputTokens
  acc.outputTokens += row.outputTokens
  acc.cacheCreationInputTokens += row.cacheCreationInputTokens
  acc.cacheReadInputTokens += row.cacheReadInputTokens
}
