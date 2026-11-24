import { validateSettingsJson } from '@renderer/features/engine/common/lib/providerCatalog'
import { importedProviders } from '@renderer/features/engine/harnesses/opencode/v1/customProvider'
import { aggregateWeekly, fillDailySeries, localDayKey } from '../../src/shared/usage/stats'

interface Sample {
  id: string
  inputSize: number
  durationMs: number
  resultSize: number
}

export function measureCalculations(runs: number): Sample[] {
  const models = Object.fromEntries(
    Array.from({ length: 10_000 }, (_, id) => ['model-' + id, { name: 'Model ' + id }])
  )
  const json = JSON.stringify({
    provider: { fixture: { npm: '@ai-sdk/openai-compatible', models } }
  })
  const now = new Date(2026, 0, 1).getTime()
  const days = Array.from({ length: 730 }, (_, index) => ({
    day: localDayKey(new Date(2026, 0, 1 - (729 - index)).getTime()),
    inputTokens: 1,
    outputTokens: 2,
    cacheCreationInputTokens: 3,
    cacheReadInputTokens: 4,
    totalCostUsd: 0
  }))
  const cases = [
    {
      id: 'S-D5-settings-json',
      inputSize: json.length,
      run: () => Number(validateSettingsJson(json).ok)
    },
    {
      id: 'S-D5-provider-import',
      inputSize: json.length,
      run: () => importedProviders(json)[0]?.models.length ?? 0
    },
    {
      id: 'S-D7-usage-aggregation',
      inputSize: days.length,
      run: () => aggregateWeekly(fillDailySeries(days, null, now)).length
    }
  ]
  return cases.flatMap(({ id, inputSize, run }) =>
    Array.from({ length: runs + 1 }, () => {
      const started = performance.now()
      const resultSize = run()
      return { id, inputSize, durationMs: performance.now() - started, resultSize }
    }).slice(1)
  )
}
