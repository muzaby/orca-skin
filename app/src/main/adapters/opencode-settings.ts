import { readFileSync } from 'node:fs'
import type { AgentModelView } from '../../shared/ipc'
import { isRecord } from '../../shared/obj'
import type { HarnessSettingsLoader } from './harness-config'

export const loadOpenCodeProviderSettings: HarnessSettingsLoader = async ({
  sourcesSettingsFile
}) => {
  const parsed: unknown = JSON.parse(readFileSync(sourcesSettingsFile, 'utf8'))
  if (!isRecord(parsed)) throw new Error('OpenCode 설정은 JSON 객체여야 합니다.')
  return { settings: parsed }
}

export function parseOpenCodeModels(config: Record<string, unknown>): AgentModelView[] {
  const models: AgentModelView[] = []
  if (!isRecord(config.provider)) return models
  for (const [providerId, provider] of Object.entries(config.provider)) {
    if (!isRecord(provider) || !isRecord(provider.models)) continue
    for (const [modelId, definition] of Object.entries(provider.models)) {
      const model = `${providerId}/${modelId}`
      const details = isRecord(definition) ? definition : {}
      models.push({
        alias: typeof details.name === 'string' ? details.name : modelId,
        model,
        providerId,
        isCustom: true,
        oneMillionContext: false,
        isDefault: config.model === model,
        variants: isRecord(details.variants)
          ? Object.entries(details.variants)
              .filter(([, v]) => !isRecord(v) || v.disabled !== true)
              .map(([k]) => k)
          : []
      })
    }
  }
  if (models.length > 0 && !models.some((model) => model.isDefault)) models[0]!.isDefault = true
  return models
}
